-- =====================================================================
-- Ami - Trợ lý học thuật | AI Academic Agent - lược đồ Supabase (Postgres)
-- Chạy toàn bộ tệp này trong Supabase → SQL Editor (một lần, chạy lại an toàn).
-- Nguyên tắc: không lưu tài liệu người dùng tải lên; chỉ lưu hồ sơ, hạn mức
-- và lịch sử trích dẫn đã thực hiện.
-- =====================================================================

-- ---------- Bảng ----------
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);

-- Email nào đăng ký sẽ tự động thành quản trị viên (master). Sửa email ở cuối tệp.
create table if not exists public.admin_emails (
  email text primary key
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  title          text not null default '',          -- học hàm/học vị: ThS., TS., PGS.TS...
  affiliation    text not null default '',
  department     text not null default '',
  position       text not null default '',
  country        text not null default 'VN',
  orcid          text not null default '',          -- 0000-0000-0000-0000
  research_fields text[] not null default '{}',
  keywords       text[] not null default '{}',
  bio            text not null default '',
  website        text not null default '',
  scholar_url    text not null default '',
  scopus_id      text not null default '',
  phone          text not null default '',
  role           text not null default 'user' check (role in ('user','admin')),
  status         text not null default 'active' check (status in ('active','suspended')),
  bonus_credits  integer not null default 0 check (bonus_credits >= 0),
  lifetime_used  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_seen      timestamptz
);

-- v2: xác nhận người dùng (nâng hạn mức tệp tải lên) - chạy lại tệp này trên cơ sở dữ liệu cũ vẫn an toàn.
alter table public.profiles add column if not exists approved boolean not null default false;
update public.profiles set approved = true where role = 'admin';

create table if not exists public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  used    integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.usage_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  source     text not null check (source in ('free','bonus','admin')),
  refunded   boolean not null default false
);
create index if not exists usage_log_user_idx on public.usage_log(user_id, created_at desc);

-- v2: chi phí API và điểm phù hợp của từng lượt phân tích (không lưu nội dung tài liệu).
alter table public.usage_log add column if not exists model text not null default '';
alter table public.usage_log add column if not exists input_tokens integer not null default 0;
alter table public.usage_log add column if not exists output_tokens integer not null default 0;
alter table public.usage_log add column if not exists cost_usd numeric(12,6) not null default 0;
alter table public.usage_log add column if not exists score integer;
create index if not exists usage_log_time_idx on public.usage_log(created_at);

create table if not exists public.credit_grants (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  admin_id   uuid references public.profiles(id) on delete set null,
  amount     integer not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- v2: đề tài (abstract) của người dùng, để gom lịch sử trích dẫn theo đề tài/luận văn.
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null default '',
  abstract   text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id, updated_at desc);

create table if not exists public.citations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  style      text not null,
  cite_lang  text not null default 'en',
  reference  text not null,         -- mục tài liệu tham khảo
  in_text    text not null default '',
  quote      text not null default '',
  page       text not null default '',
  priority   text not null default '',
  project    text not null default '', -- nhãn đề tài (tùy chọn)
  source     jsonb not null default '{}'::jsonb -- siêu dữ liệu nguồn (tiêu đề, tác giả, năm, DOI...)
);
-- v2: gắn đề tài và điểm phù hợp cho từng trích dẫn.
alter table public.citations add column if not exists score integer;
alter table public.citations add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.citations add column if not exists abstract_hash text not null default '';
alter table public.citations add column if not exists abstract_title text not null default '';
create index if not exists citations_user_idx on public.citations(user_id, created_at desc);

-- v2: bộ đếm truy cập ẩn danh (không lưu IP, không cookie). Chỉ máy chủ (service_role) đọc/ghi qua hàm bên dưới.
create table if not exists public.visit_days (day date primary key, n bigint not null default 0);
create table if not exists public.visit_countries (country text primary key, n bigint not null default 0);

-- ---------- Cấu hình mặc định ----------
insert into public.app_settings(key, value) values
  ('free_daily_limit', '1'::jsonb),
  ('file_limit_basic_mb', '2'::jsonb),
  ('file_limit_approved_mb', '15'::jsonb),
  ('usd_vnd', '25500'::jsonb),
  ('contact', '{"email":"","phone":"","zalo":"","note_vi":"","note_en":""}'::jsonb)
on conflict (key) do nothing;

-- ---------- Hàm tiện ích ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- "Hôm nay" tính theo giờ Việt Nam để hạn mức đặt lại lúc 00:00 (UTC+7).
create or replace function public.vn_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date; $$;

create or replace function public.free_limit() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'free_daily_limit'), 1);
$$;

-- Hạn mức dung lượng tệp (MB): người dùng đã được quản trị viên xác thực dùng mức cao hơn.
create or replace function public.file_limit_mb(p_approved boolean) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = case when p_approved then 'file_limit_approved_mb' else 'file_limit_basic_mb' end),
                  case when p_approved then 15 else 2 end);
$$;

-- ---------- Giới thiệu đồng nghiệp (liên kết cá nhân ?ref=<mã 7 ký tự>) ----------
-- Người được giới thiệu đăng ký bằng liên kết và phân tích xong lần đầu thì người giới thiệu nhận thêm lượt (referral_bonus, tối đa referral_cap).
alter table public.profiles add column if not exists ref_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists referral_paid boolean not null default false;
update public.profiles set ref_code = substr(md5(id::text || clock_timestamp()::text), 1, 7) where ref_code is null;
create unique index if not exists profiles_ref_code_idx on public.profiles(ref_code);

insert into public.app_settings(key, value) values
  ('referral_bonus', '1'::jsonb),
  ('referral_cap', '5'::jsonb)
on conflict (key) do nothing;

-- ---------- Tạo hồ sơ khi có tài khoản mới ----------
-- Tạo hồ sơ khi có tài khoản mới: quản trị theo admin_emails, mã giới thiệu riêng, và người giới thiệu (nếu có và hợp lệ).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm boolean := exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(new.email,'')));
  code text;
  inviter uuid;
  want text := lower(coalesce(new.raw_user_meta_data->>'ref', ''));
begin
  loop
    code := substr(md5(gen_random_uuid()::text), 1, 7);
    exit when not exists (select 1 from public.profiles where ref_code = code);
  end loop;
  if want ~ '^[a-z0-9]{7}$' then select id into inviter from public.profiles where ref_code = want; end if;
  insert into public.profiles(id, email, full_name, role, approved, ref_code, referred_by)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when adm then 'admin' else 'user' end, adm, code, inviter
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nếu email được thêm vào admin_emails sau khi đã đăng ký thì tự nâng quyền.
create or replace function public.sync_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = 'admin', approved = true where lower(email) = lower(new.email);
  return new;
end $$;
drop trigger if exists on_admin_email_added on public.admin_emails;
create trigger on_admin_email_added after insert on public.admin_emails
  for each row execute function public.sync_admin_role();

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


-- ---------- Hạn mức (chỉ máy chủ gọi bằng service_role) ----------
-- Trả về jsonb: { ok, source, reason, free_left, bonus }
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

-- Hoàn lại lượt khi phân tích thất bại hoặc tài liệu không được hỗ trợ.
create or replace function public.refund_credit(p_user uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := public.vn_today(); lid bigint;
begin
  select id into lid from public.usage_log
    where user_id = p_user and source = p_source and not refunded
    order by id desc limit 1 for update;
  if lid is null then return; end if;
  update public.usage_log set refunded = true where id = lid;
  update public.profiles set lifetime_used = greatest(lifetime_used - 1, 0) where id = p_user;
  if p_source = 'free' then
    update public.usage_daily set used = greatest(used - 1, 0) where user_id = p_user and day = d;
  elsif p_source = 'bonus' then
    update public.profiles set bonus_credits = bonus_credits + 1 where id = p_user;
  end if;
end $$;

-- Trả thưởng giới thiệu một lần cho người giới thiệu khi người được giới thiệu phân tích xong lần đầu.
create or replace function public.pay_referral(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  inviter uuid; paid boolean; bonus int; cap int; so_far int; amt int;
begin
  select referred_by, referral_paid into inviter, paid from public.profiles where id = p_user and role <> 'admin';
  if inviter is null or paid then return; end if;
  update public.profiles set referral_paid = true where id = p_user;
  bonus := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'referral_bonus'), 1);
  cap := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'referral_cap'), 5);
  select coalesce(sum(amount), 0)::int into so_far from public.credit_grants where user_id = inviter and note = 'referral';
  amt := least(bonus, cap - so_far);
  if amt > 0 then
    update public.profiles set bonus_credits = bonus_credits + amt where id = inviter;
    insert into public.credit_grants(user_id, admin_id, amount, note) values (inviter, null, amt, 'referral');
  end if;
end $$;

-- Ghi chi phí API thực tế của một lượt; lượt phân tích thành công (có điểm) là lúc trả thưởng giới thiệu.
create or replace function public.record_usage(p_log bigint, p_model text, p_in integer, p_out integer, p_cost numeric, p_score integer)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  update public.usage_log set model = coalesce(p_model, ''), input_tokens = greatest(coalesce(p_in, 0), 0),
    output_tokens = greatest(coalesce(p_out, 0), 0), cost_usd = greatest(coalesce(p_cost, 0), 0), score = p_score
  where id = p_log returning user_id into uid;
  if p_score is not null and uid is not null then perform public.pay_referral(uid); end if;
end $$;

create or replace function public.record_visit(p_country text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.visit_days(day, n) values (public.vn_today(), 1) on conflict (day) do update set n = visit_days.n + 1;
  if p_country ~ '^[A-Z]{2}$' and p_country not in ('XX', 'T1') then
    insert into public.visit_countries(country, n) values (p_country, 1) on conflict (country) do update set n = visit_countries.n + 1;
  end if;
end $$;

create or replace function public.visit_stats(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', coalesce((select sum(n) from public.visit_days), 0),
    'today', coalesce((select n from public.visit_days where day = public.vn_today()), 0),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('d', g::date, 'n', coalesce(v.n, 0)) order by g), '[]'::jsonb)
             from generate_series(public.vn_today() - (greatest(p_days, 1) - 1), public.vn_today(), interval '1 day') g
             left join public.visit_days v on v.day = g::date),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('c', country, 'n', n) order by n desc), '[]'::jsonb)
                  from (select country, n from public.visit_countries order by n desc limit 10) t)
  );
$$;

revoke all on function public.record_usage(bigint, text, integer, integer, numeric, integer) from public, anon, authenticated;
revoke all on function public.record_visit(text) from public, anon, authenticated;
revoke all on function public.visit_stats(integer) from public, anon, authenticated;
grant execute on function public.record_usage(bigint, text, integer, integer, numeric, integer) to service_role;
revoke all on function public.pay_referral(uuid) from public, anon, authenticated;
grant execute on function public.pay_referral(uuid) to service_role;
grant execute on function public.record_visit(text) to service_role;
grant execute on function public.visit_stats(integer) to service_role;

revoke all on function public.consume_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;

-- Hạn mức của chính người dùng đang đăng nhập.
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

-- ---------- Quản trị ----------
drop function if exists public.admin_list_users(text, int, int);
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


-- Cộng (hoặc trừ, nếu âm) lượt dùng thêm cho một người dùng.
create or replace function public.admin_grant_credits(p_user uuid, p_amount int, p_note text default '')
returns int language plpgsql security definer set search_path = public as $$
declare nb int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set bonus_credits = greatest(bonus_credits + p_amount, 0)
    where id = p_user returning bonus_credits into nb;
  if nb is null then raise exception 'user not found'; end if;
  insert into public.credit_grants(user_id, admin_id, amount, note) values (p_user, auth.uid(), p_amount, coalesce(p_note, ''));
  return nb;
end $$;
grant execute on function public.admin_grant_credits(uuid, int, text) to authenticated;

drop function if exists public.admin_set_user(uuid, text, text);
create or replace function public.admin_set_user(p_user uuid, p_role text default null, p_status text default null, p_approved boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() and (p_role = 'user' or p_status = 'suspended') then
    raise exception 'cannot demote or suspend yourself';
  end if;
  update public.profiles set
    role = coalesce(p_role, role), status = coalesce(p_status, status),
    approved = case when coalesce(p_role, role) = 'admin' then true else coalesce(p_approved, approved) end
  where id = p_user;
end $$;
grant execute on function public.admin_set_user(uuid, text, text, boolean) to authenticated;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'approved_users', (select count(*) from public.profiles where approved or role = 'admin'),
    'pending_users', (select count(*) from public.profiles where not approved and role <> 'admin'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'analyses_today', (select count(*) from public.usage_log where kind = 'analyze' and not refunded and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.vn_today()),
    'analyses_7d', (select count(*) from public.usage_log where kind = 'analyze' and not refunded and created_at > now() - interval '7 days'),
    'analyses_total', (select count(*) from public.usage_log where kind = 'analyze' and not refunded),
    'refunded_total', (select count(*) from public.usage_log where kind = 'analyze' and refunded),
    'citations_total', (select count(*) from public.citations),
    'bonus_outstanding', (select coalesce(sum(bonus_credits), 0) from public.profiles),
    'exhausted_today', (select count(*) from public.usage_daily d join public.profiles p on p.id = d.user_id
                        where d.day = public.vn_today() and d.used >= public.free_limit() and p.bonus_credits = 0 and p.role = 'user'),
    'cost_total', (select coalesce(sum(cost_usd), 0) from public.usage_log),
    'cost_today', (select coalesce(sum(cost_usd), 0) from public.usage_log where (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.vn_today()),
    'cost_30d', (select coalesce(sum(cost_usd), 0) from public.usage_log where created_at > now() - interval '30 days'),
    'cost_refunded', (select coalesce(sum(cost_usd), 0) from public.usage_log where refunded),
    'review_cost_total', (select coalesce(sum(cost_usd), 0) from public.usage_log where kind in ('review', 'review_template')),
    'review_cost_30d', (select coalesce(sum(cost_usd), 0) from public.usage_log where kind in ('review', 'review_template') and created_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.usage_log where kind = 'review' and not refunded and created_at > now() - interval '30 days'),
    'reviews_total', (select count(*) from public.usage_log where kind = 'review' and not refunded),
    'tokens_in', (select coalesce(sum(input_tokens), 0) from public.usage_log),
    'tokens_out', (select coalesce(sum(output_tokens), 0) from public.usage_log)
  ) into r;
  return r;
end $$;

-- Chuỗi thời gian theo ngày (giờ Việt Nam) cho biểu đồ quản trị.
drop function if exists public.admin_timeseries(integer);
create or replace function public.admin_timeseries(p_days integer default 30)
returns table (day date, analyses integer, refunded integer, cost_usd numeric, input_tokens bigint, output_tokens bigint, new_users integer, citations integer, review_cost_usd numeric, reviews integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select g::date,
      coalesce((select count(*) from public.usage_log l where l.kind = 'analyze' and not l.refunded and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select count(*) from public.usage_log l where l.kind = 'analyze' and l.refunded and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select sum(l.cost_usd) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0),
      coalesce((select sum(l.input_tokens) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::bigint,
      coalesce((select sum(l.output_tokens) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::bigint,
      coalesce((select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select count(*) from public.citations c where (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select sum(l.cost_usd) from public.usage_log l where l.kind in ('review', 'review_template') and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0),
      coalesce((select count(*) from public.usage_log l where l.kind = 'review' and not l.refunded and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int
    from generate_series(public.vn_today() - (least(greatest(p_days, 1), 365) - 1), public.vn_today(), interval '1 day') g
    order by 1;
end $$;

create or replace function public.admin_top_users(p_days integer default 30, p_limit integer default 8)
returns table (user_id uuid, email text, full_name text, analyses bigint, cost_usd numeric, tokens bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, count(*) filter (where not l.refunded), coalesce(sum(l.cost_usd), 0),
           coalesce(sum(l.input_tokens + l.output_tokens), 0)::bigint
    from public.usage_log l join public.profiles p on p.id = l.user_id
    where l.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
    group by p.id, p.email, p.full_name
    order by 5 desc
    limit least(p_limit, 50);
end $$;

-- Phân bố điểm phù hợp (10 khoảng: 0-9, 10-19, ..., 90-100).
create or replace function public.admin_score_hist(p_days integer default 30)
returns table (bucket integer, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select b, count(l.id) from generate_series(0, 9) b
    left join public.usage_log l on l.score is not null and not l.refunded
      and least(l.score / 10, 9) = b and l.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
    group by b order by b;
end $$;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_timeseries(integer) to authenticated;
grant execute on function public.admin_top_users(integer, integer) to authenticated;
grant execute on function public.admin_score_hist(integer) to authenticated;

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
  if p_key not in ('free_daily_limit', 'contact', 'file_limit_basic_mb', 'file_limit_approved_mb', 'usd_vnd', 'basic_weekly_limit', 'tier_start', 'referral_bonus', 'referral_cap', 'review_weekly_limit') then raise exception 'unknown setting'; end if;
  if p_key = 'tier_start' and (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date'; end if;
  insert into public.app_settings(key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
end $$;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- ---------- Bảo mật cấp hàng (RLS) ----------
alter table public.app_settings  enable row level security;
alter table public.admin_emails  enable row level security;
alter table public.profiles      enable row level security;
alter table public.usage_daily   enable row level security;
alter table public.usage_log     enable row level security;
alter table public.credit_grants enable row level security;
alter table public.citations     enable row level security;
alter table public.projects      enable row level security;
alter table public.visit_days    enable row level security;
alter table public.visit_countries enable row level security;

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select using (true);   -- cần để hiện thông tin liên hệ

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists usage_read on public.usage_daily;
create policy usage_read on public.usage_daily for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists log_read on public.usage_log;
create policy log_read on public.usage_log for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists grants_read on public.credit_grants;
create policy grants_read on public.credit_grants for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists citations_all on public.citations;
drop policy if exists citations_select on public.citations;
drop policy if exists citations_insert on public.citations;
drop policy if exists citations_update on public.citations;
drop policy if exists citations_delete on public.citations;
create policy citations_select on public.citations for select using (user_id = auth.uid() and public.can_view_history());
create policy citations_insert on public.citations for insert with check (user_id = auth.uid());
create policy citations_update on public.citations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy citations_delete on public.citations for delete using (user_id = auth.uid());

drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Người dùng chỉ được sửa các cột hồ sơ học thuật; không tự đổi role, status, hạn mức.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, title, affiliation, department, position, country, orcid, research_fields,
              keywords, bio, website, scholar_url, scopus_id, phone, updated_at)
  on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- ---------- Ngân sách API (chỉ quản trị viên) ----------
create table if not exists public.admin_kv (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_kv enable row level security;
revoke all on public.admin_kv from anon;
drop policy if exists admin_kv_all on public.admin_kv;
create policy admin_kv_all on public.admin_kv for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_spend_since(p_since timestamptz)
returns table (cost_usd numeric, input_tokens bigint, output_tokens bigint, analyses bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select coalesce(sum(l.cost_usd), 0), coalesce(sum(l.input_tokens), 0)::bigint, coalesce(sum(l.output_tokens), 0)::bigint,
           count(*) filter (where not l.refunded)
    from public.usage_log l where l.created_at >= p_since;
end $$;
grant execute on function public.admin_spend_since(timestamptz) to authenticated;

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

-- Thống kê giới thiệu (quản trị): số tài khoản đến từ liên kết, số đã phân tích xong lần đầu, tổng lượt đã thưởng.
create or replace function public.admin_referrals(p_days integer default 30)
returns table (invited integer, converted integer, credits integer, referrers integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select (count(*) filter (where p.referred_by is not null))::int,
           (count(*) filter (where p.referred_by is not null and p.referral_paid))::int,
           coalesce((select sum(g.amount) from public.credit_grants g where g.note = 'referral'
                     and g.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))), 0)::int,
           (count(distinct p.referred_by))::int
    from public.profiles p where p.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365));
end $$;
grant execute on function public.admin_referrals(integer) to authenticated;

-- ---------- Quản trị viên master ----------
-- Thay bằng email của bạn rồi chạy lại. Tài khoản đăng ký bằng email này sẽ là master (không giới hạn lượt).
-- insert into public.admin_emails(email) values ('ban@example.com') on conflict do nothing;

-- ---------- Phản biện học thuật: hạn mức riêng, tách khỏi lượt phân tích ----------
-- Chỉ người dùng đã xác thực (và quản trị viên) dùng được. Hạn mức theo tuần (giờ Việt Nam), do quản trị viên đặt.
alter table public.usage_log add column if not exists kind text not null default 'analyze' check (kind in ('analyze', 'review', 'review_template'));
alter table public.usage_log drop constraint if exists usage_log_kind_check;
alter table public.usage_log add constraint usage_log_kind_check check (kind in ('analyze', 'review', 'review_template'));
alter table public.usage_log add column if not exists corpus_hash text;
alter table public.usage_log add column if not exists fails integer not null default 0;
alter table public.usage_log add column if not exists units_done integer not null default 0;
alter table public.profiles add column if not exists review_limit integer check (review_limit is null or review_limit >= 0);
-- Mặc định 0: tính năng cao cấp, chỉ mở cho người được quản trị viên phê duyệt (review_limit riêng từng người; null = theo mặc định chung).
insert into public.app_settings(key, value) values ('review_weekly_limit', '0'::jsonb)
  on conflict (key) do update set value = '0'::jsonb where public.app_settings.value = '2'::jsonb;

create table if not exists public.review_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  evidence    text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note  text not null default '',
  granted     integer,
  decided_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists review_requests_user_idx on public.review_requests(user_id, created_at desc);
create unique index if not exists review_requests_one_pending on public.review_requests(user_id) where status = 'pending';
alter table public.review_requests enable row level security;

-- Hoàn lượt phân tích chỉ tìm trong các lượt phân tích (không nhầm với lượt phản biện).
create or replace function public.refund_credit(p_user uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := public.vn_today(); lid bigint;
begin
  select id into lid from public.usage_log
    where user_id = p_user and source = p_source and kind = 'analyze' and not refunded
    order by id desc limit 1 for update;
  if lid is null then return; end if;
  update public.usage_log set refunded = true where id = lid;
  update public.profiles set lifetime_used = greatest(lifetime_used - 1, 0) where id = p_user;
  if p_source = 'free' then
    update public.usage_daily set used = greatest(used - 1, 0) where user_id = p_user and day = d;
  elsif p_source = 'bonus' then
    update public.profiles set bonus_credits = bonus_credits + 1 where id = p_user;
  end if;
end $$;

-- Trạng thái hạn mức phản biện của một người dùng (dùng cho máy chủ và cho my_review_quota).
create or replace function public.review_quota_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  lim integer; used integer;
  ws date := public.vn_week_start(public.vn_today());
begin
  select * into p from public.profiles where id = p_user;
  if not found then return jsonb_build_object('eligible', false, 'has_access', false, 'limit', 0, 'used', 0, 'left', 0, 'unlimited', false); end if;
  lim := coalesce(p.review_limit, (select (value #>> '{}')::int from public.app_settings where key = 'review_weekly_limit'), 0);
  select count(*)::int into used from public.usage_log
    where user_id = p_user and kind = 'review' and not refunded and (created_at at time zone 'Asia/Ho_Chi_Minh')::date >= ws;
  return jsonb_build_object(
    'eligible', (p.approved or p.role = 'admin'),
    'has_access', (p.role = 'admin' or (p.approved and lim > 0)),
    'unlimited', p.role = 'admin',
    'limit', lim, 'used', used, 'left', greatest(lim - used, 0),
    'next_reset', (ws + 7)::text);
end $$;

create or replace function public.my_review_quota() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.review_quota_of(auth.uid());
$$;
grant execute on function public.my_review_quota() to authenticated;

-- Bắt đầu một lượt phản biện (máy chủ gọi bằng service_role): kiểm tra và ghi nhận ngay, hoàn lại nếu chưa có phần nào hoàn tất.
create or replace function public.consume_review(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype; q jsonb; lid bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if not (p.approved or p.role = 'admin') then return jsonb_build_object('ok', false, 'reason', 'not_verified'); end if;
  q := public.review_quota_of(p_user);
  if not (q ->> 'has_access')::boolean then return jsonb_build_object('ok', false, 'reason', 'no_access', 'quota', q); end if;
  if p.role <> 'admin' and (q ->> 'left')::int <= 0 then return jsonb_build_object('ok', false, 'reason', 'quota_exhausted', 'quota', q); end if;
  insert into public.usage_log(user_id, source, kind) values (p_user, case when p.role = 'admin' then 'admin' else 'free' end, 'review') returning id into lid;
  update public.profiles set last_seen = now() where id = p_user;
  return jsonb_build_object('ok', true, 'log_id', lid, 'quota', public.review_quota_of(p_user));
end $$;

-- Hoàn lượt phản biện chỉ khi chưa có phần nào được AI xử lý xong.
create or replace function public.refund_review(p_log bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.usage_log%rowtype;
begin
  select * into r from public.usage_log where id = p_log and kind = 'review' for update;
  if not found or r.refunded or r.units_done > 0 then return false; end if;
  update public.usage_log set refunded = true where id = p_log;
  return true;
end $$;

-- Cộng dồn chi phí API của từng lần gọi AI (kể cả lần lỗi); trả về số phần đã hoàn tất. Dùng cho lượt phản biện và cho bước tách mẫu.
drop function if exists public.add_usage(bigint, text, integer, integer, numeric, boolean);
create or replace function public.add_usage(p_log bigint, p_model text, p_in integer, p_out integer, p_cost numeric, p_unit boolean, p_failed boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.usage_log set model = coalesce(nullif(p_model, ''), model),
    input_tokens = input_tokens + greatest(coalesce(p_in, 0), 0), output_tokens = output_tokens + greatest(coalesce(p_out, 0), 0),
    cost_usd = cost_usd + greatest(coalesce(p_cost, 0), 0), units_done = units_done + (case when p_unit then 1 else 0 end),
    fails = fails + (case when p_failed then 1 else 0 end)
  where id = p_log and kind in ('review', 'review_template') returning units_done into n;
  return coalesce(n, 0);
end $$;

-- Buộc mọi bước của một lượt dùng cùng một văn bản: bước đầu ghi mã băm, các bước sau phải khớp.
create or replace function public.bind_review(p_log bigint, p_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  update public.usage_log set corpus_hash = coalesce(corpus_hash, p_hash) where id = p_log and kind = 'review' returning corpus_hash into h;
  return h is not null and h = p_hash;
end $$;

-- Bước tách mẫu: ghi một dòng nhật ký riêng và giới hạn tần suất theo giờ cho mỗi người (quản trị viên không giới hạn).
create or replace function public.log_template(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype; n integer; lid bigint;
begin
  select * into p from public.profiles where id = p_user;
  if not found or p.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select count(*)::int into n from public.usage_log where user_id = p_user and kind = 'review_template' and created_at > now() - interval '1 hour';
  if p.role <> 'admin' and n >= 10 then return jsonb_build_object('ok', false, 'reason', 'rate'); end if;
  insert into public.usage_log(user_id, source, kind) values (p_user, case when p.role = 'admin' then 'admin' else 'free' end, 'review_template') returning id into lid;
  return jsonb_build_object('ok', true, 'log_id', lid);
end $$;

-- Kết thúc lượt phản biện thành công: ghi điểm đề xuất và trả thưởng giới thiệu (nếu có).
create or replace function public.finish_review(p_log bigint, p_score integer) returns void
language plpgsql security definer set search_path = public as $$
declare r public.usage_log%rowtype;
begin
  select * into r from public.usage_log where id = p_log and kind = 'review' for update;
  -- Chỉ ghi điểm và trả thưởng giới thiệu khi đã có ít nhất một phần AI xử lý xong và lượt chưa bị hoàn.
  if not found or r.refunded or r.units_done <= 0 then return; end if;
  update public.usage_log set score = p_score where id = p_log;
  if p_score is not null then perform public.pay_referral(r.user_id); end if;
end $$;

-- Người dùng đã xác thực gửi đề nghị cấp hạn mức kèm lý do và minh chứng khoa học; quản trị viên xét duyệt.
create or replace function public.submit_review_request(p_reason text, p_evidence text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype; rid bigint;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found or p.status <> 'active' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (p.approved or p.role = 'admin') then raise exception 'not_verified' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 40 or length(btrim(coalesce(p_evidence, ''))) < 20 then raise exception 'too_short'; end if;
  if exists (select 1 from public.review_requests where user_id = p.id and status = 'pending') then raise exception 'already_pending'; end if;
  insert into public.review_requests(user_id, reason, evidence) values (p.id, left(btrim(p_reason), 3000), left(btrim(p_evidence), 3000)) returning id into rid;
  return jsonb_build_object('id', rid, 'status', 'pending');
end $$;
grant execute on function public.submit_review_request(text, text) to authenticated;

create or replace function public.my_review_request() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select to_jsonb(r) - 'user_id' - 'decided_by' from public.review_requests r where r.user_id = auth.uid() order by r.id desc limit 1), 'null'::jsonb);
$$;
grant execute on function public.my_review_request() to authenticated;

create or replace function public.admin_list_review_requests(p_status text default 'pending', p_limit int default 100)
returns table (id bigint, user_id uuid, email text, full_name text, affiliation text, orcid text, lifetime_used integer, reason text, evidence text, status text, admin_note text, granted integer, created_at timestamptz, decided_at timestamptz, review_limit integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, r.user_id, p.email, p.full_name, p.affiliation, p.orcid, p.lifetime_used, r.reason, r.evidence, r.status, r.admin_note, r.granted, r.created_at, r.decided_at, p.review_limit
    from public.review_requests r join public.profiles p on p.id = r.user_id
    where p_status = 'all' or r.status = p_status
    order by r.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;
grant execute on function public.admin_list_review_requests(text, int) to authenticated;

create or replace function public.admin_decide_review(p_id bigint, p_approve boolean, p_limit integer default 2, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare r public.review_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.review_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'not_pending'; end if;
  update public.review_requests set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = left(coalesce(p_note, ''), 1000), granted = case when p_approve then greatest(coalesce(p_limit, 2), 1) else null end,
    decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_approve then update public.profiles set review_limit = greatest(coalesce(p_limit, 2), 1) where id = r.user_id; end if;
end $$;
grant execute on function public.admin_decide_review(bigint, boolean, integer, text) to authenticated;

-- Điều chỉnh hoặc thu hồi hạn mức của một người (0 = thu hồi; null = theo mặc định chung).
create or replace function public.admin_set_review_limit(p_user uuid, p_limit integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set review_limit = p_limit where id = p_user;
end $$;
grant execute on function public.admin_set_review_limit(uuid, integer) to authenticated;

revoke all on function public.review_quota_of(uuid) from public, anon, authenticated;
revoke all on function public.consume_review(uuid) from public, anon, authenticated;
revoke all on function public.refund_review(bigint) from public, anon, authenticated;
revoke all on function public.add_usage(bigint, text, integer, integer, numeric, boolean, boolean) from public, anon, authenticated;
revoke all on function public.bind_review(bigint, text) from public, anon, authenticated;
revoke all on function public.log_template(uuid) from public, anon, authenticated;
revoke all on function public.finish_review(bigint, integer) from public, anon, authenticated;
grant execute on function public.review_quota_of(uuid) to service_role;
grant execute on function public.consume_review(uuid) to service_role;
grant execute on function public.refund_review(bigint) to service_role;
grant execute on function public.add_usage(bigint, text, integer, integer, numeric, boolean, boolean) to service_role;
grant execute on function public.bind_review(bigint, text) to service_role;
grant execute on function public.log_template(uuid) to service_role;
grant execute on function public.finish_review(bigint, integer) to service_role;
