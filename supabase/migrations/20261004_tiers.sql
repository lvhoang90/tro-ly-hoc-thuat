-- Hạng người dùng: Cơ bản (1 lượt/tuần từ 10/10/2026) và Đã xác thực (hạn mức riêng). Chạy một lần trong Supabase → SQL Editor (chạy lại an toàn).
-- Cần tệp schema.sql đã chạy trước đó (các hàm vn_today, free_limit, file_limit_mb, is_admin...).
-- ---------- Hạng người dùng và hạn mức theo hạng ----------
-- Cơ bản (chưa xác thực): từ ngày tier_start dùng basic_weekly_limit lượt mỗi tuần (tuần bắt đầu thứ Hai, giờ Việt Nam).
-- Đã xác thực: hạn mức riêng do quản trị viên đặt (quota_limit/quota_period); chưa đặt thì free_daily_limit lượt mỗi ngày.
alter table public.profiles add column if not exists quota_limit integer check (quota_limit >= 0);
alter table public.profiles add column if not exists quota_period text check (quota_period in ('day', 'week'));

insert into public.app_settings(key, value) values
  ('basic_weekly_limit', '1'::jsonb),
  ('tier_start', '"2026-10-10"'::jsonb)
on conflict (key) do nothing;

create or replace function public.tier_start() returns date
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::date from public.app_settings where key = 'tier_start'), date '2026-10-10');
$$;

create or replace function public.tier_active() returns boolean
language sql stable security definer set search_path = public as $$ select public.vn_today() >= public.tier_start(); $$;

-- Thứ Hai của tuần chứa ngày d.
create or replace function public.vn_week_start(d date) returns date
language sql immutable as $$ select d - (extract(isodow from d)::int - 1); $$;

-- Quy tắc hạn mức của một người: { tier, limit, period }.
create or replace function public.quota_rule(p public.profiles) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when p.role = 'admin' then jsonb_build_object('tier', 'admin', 'limit', 0, 'period', 'day')
    when p.approved then jsonb_build_object('tier', 'verified', 'limit', coalesce(p.quota_limit, public.free_limit()), 'period', coalesce(p.quota_period, 'day'))
    when public.tier_active() then jsonb_build_object('tier', 'basic',
      'limit', coalesce((select (value #>> '{}')::int from public.app_settings where key = 'basic_weekly_limit'), 1), 'period', 'week')
    else jsonb_build_object('tier', 'basic', 'limit', public.free_limit(), 'period', 'day')
  end;
$$;

-- Số lượt đã dùng trong chu kỳ hiện tại (hôm nay hoặc tuần này).
create or replace function public.quota_used(p_user uuid, p_period text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(used), 0)::int from public.usage_daily
  where user_id = p_user and day between (case when p_period = 'week' then public.vn_week_start(public.vn_today()) else public.vn_today() end) and public.vn_today();
$$;

create or replace function public.can_view_history() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (approved or role = 'admin' or not public.tier_active()));
$$;
grant execute on function public.can_view_history() to authenticated;

create or replace function public.my_citation_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.citations where user_id = auth.uid();
$$;
grant execute on function public.my_citation_count() to authenticated;

create or replace function public.consume_credit(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  rule jsonb;
  lim integer;
  per text;
  d date := public.vn_today();
  used_now integer;
  src text;
  lid bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;

  rule := public.quota_rule(p);
  lim := (rule ->> 'limit')::int;
  per := rule ->> 'period';

  insert into public.usage_daily(user_id, day, used) values (p_user, d, 0) on conflict do nothing;
  perform 1 from public.usage_daily where user_id = p_user and day = d for update;
  used_now := public.quota_used(p_user, per);

  if p.role = 'admin' then
    src := 'admin';
  elsif used_now < lim then
    update public.usage_daily set used = used + 1 where user_id = p_user and day = d;
    used_now := used_now + 1;
    src := 'free';
  elsif p.bonus_credits > 0 then
    update public.profiles set bonus_credits = bonus_credits - 1 where id = p_user;
    p.bonus_credits := p.bonus_credits - 1;
    src := 'bonus';
  else
    return jsonb_build_object('ok', false, 'reason', 'quota_exhausted', 'free_left', 0, 'bonus', 0);
  end if;

  update public.profiles set lifetime_used = lifetime_used + 1, last_seen = now() where id = p_user;
  insert into public.usage_log(user_id, source) values (p_user, src) returning id into lid;
  return jsonb_build_object('ok', true, 'source', src, 'log_id', lid,
    'free_left', greatest(lim - used_now, 0), 'bonus', p.bonus_credits);
end $$;

create or replace function public.my_quota() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles%rowtype; rule jsonb; lim integer; per text; u integer; mb integer; tier text; d date := public.vn_today();
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  rule := public.quota_rule(p);
  tier := rule ->> 'tier';
  per := rule ->> 'period';
  lim := case when tier = 'admin' then public.free_limit() else (rule ->> 'limit')::int end;
  u := public.quota_used(p.id, per);
  mb := public.file_limit_mb(p.approved or p.role = 'admin');
  return jsonb_build_object(
    'role', p.role, 'status', p.status, 'unlimited', p.role = 'admin', 'approved', p.approved or p.role = 'admin',
    'max_file_mb', mb,
    'free_limit', lim, 'used_today', u, 'free_left', greatest(lim - u, 0),
    'bonus', p.bonus_credits, 'lifetime_used', p.lifetime_used,
    'tier', tier, 'period', per,
    'next_reset', case when per = 'week' then public.vn_week_start(d) + 7 else d + 1 end,
    'gated', tier = 'basic' and public.tier_active(),
    'tier_start', public.tier_start(),
    'basic_weekly', coalesce((select (value #>> '{}')::int from public.app_settings where key = 'basic_weekly_limit'), 1));
end $$;
grant execute on function public.my_quota() to authenticated;

-- ---------- Quản trị: hạn mức riêng, người dùng thường xuyên, cài đặt hạng ----------
drop function if exists public.admin_list_users(text, int, int, boolean);
create or replace function public.admin_list_users(p_search text default '', p_limit int default 50, p_offset int default 0, p_pending boolean default false, p_frequent boolean default false)
returns table (
  id uuid, email text, full_name text, affiliation text, orcid text, role text, status text, approved boolean,
  bonus_credits int, lifetime_used int, used_today int, cost_usd numeric, created_at timestamptz, last_seen timestamptz,
  quota_limit int, quota_period text, active_days int, phone text, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, p.affiliation, p.orcid, p.role, p.status, p.approved or p.role = 'admin',
           p.bonus_credits, p.lifetime_used,
           coalesce(ud.used, 0), coalesce((select sum(l.cost_usd) from public.usage_log l where l.user_id = p.id), 0),
           p.created_at, p.last_seen, p.quota_limit, p.quota_period,
           (select count(*)::int from public.usage_daily x where x.user_id = p.id and x.used > 0), p.phone,
           count(*) over()
    from public.profiles p
    left join public.usage_daily ud on ud.user_id = p.id and ud.day = public.vn_today()
    where (p_search = '' or p.email ilike '%'||p_search||'%' or p.full_name ilike '%'||p_search||'%'
       or p.orcid ilike '%'||p_search||'%' or p.affiliation ilike '%'||p_search||'%')
      and (not p_pending or (not p.approved and p.role <> 'admin'))
      and (not p_frequent or (not p.approved and p.role <> 'admin' and p.lifetime_used >= 2
           and (select count(*) from public.usage_daily x where x.user_id = p.id and x.used > 0) >= 2))
    order by case when p_frequent then p.lifetime_used end desc nulls last, p.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;
grant execute on function public.admin_list_users(text, int, int, boolean, boolean) to authenticated;

-- Đặt hạn mức riêng cho người dùng đã xác thực (p_limit null: về mặc định).
create or replace function public.admin_set_quota(p_user uuid, p_limit int, p_period text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_limit is not null and (p_limit < 0 or p_limit > 1000) then raise exception 'invalid limit'; end if;
  if p_period is not null and p_period not in ('day', 'week') then raise exception 'invalid period'; end if;
  update public.profiles set quota_limit = p_limit, quota_period = case when p_limit is null then null else coalesce(p_period, 'day') end where id = p_user;
end $$;
grant execute on function public.admin_set_quota(uuid, int, text) to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_key not in ('free_daily_limit', 'contact', 'file_limit_basic_mb', 'file_limit_approved_mb', 'usd_vnd', 'basic_weekly_limit', 'tier_start') then raise exception 'unknown setting'; end if;
  if p_key = 'tier_start' and (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date'; end if;
  insert into public.app_settings(key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
end $$;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- Hành trình người dùng: những người đăng ký trong p_days ngày gần nhất đi được đến đâu (không tính quản trị viên).
create or replace function public.admin_funnel(p_days integer default 30)
returns table (registered integer, analysed integer, returned integer, cited integer, verified integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    with c as (
      select p.id, p.approved from public.profiles p
      where p.role <> 'admin' and p.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
    )
    select count(*)::int,
      (count(*) filter (where exists (select 1 from public.usage_log l where l.user_id = c.id and not l.refunded)))::int,
      (count(*) filter (where (select count(*) from public.usage_daily d where d.user_id = c.id and d.used > 0) >= 2))::int,
      (count(*) filter (where exists (select 1 from public.citations x where x.user_id = c.id)))::int,
      (count(*) filter (where c.approved))::int
    from c;
end $$;
grant execute on function public.admin_funnel(integer) to authenticated;

-- ---------- Lịch sử trích dẫn: hạng Cơ bản chỉ xem lại được khi đã xác thực (dữ liệu vẫn được lưu) ----------
drop policy if exists citations_all on public.citations;
drop policy if exists citations_select on public.citations;
drop policy if exists citations_insert on public.citations;
drop policy if exists citations_update on public.citations;
drop policy if exists citations_delete on public.citations;
create policy citations_select on public.citations for select using (user_id = auth.uid() and public.can_view_history());
create policy citations_insert on public.citations for insert with check (user_id = auth.uid());
create policy citations_update on public.citations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy citations_delete on public.citations for delete using (user_id = auth.uid());
