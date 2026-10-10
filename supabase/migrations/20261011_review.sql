-- Tính năng Phản biện học thuật. Chạy một lần trong Supabase → SQL Editor (chạy lại an toàn). Cần schema.sql, 20261004_tiers.sql, 20261010_ecosystem.sql đã chạy trước đó.
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

-- Cho phép quản trị viên đặt hạn mức phản biện mỗi tuần.
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

-- Bảng điều khiển chỉ đếm lượt phân tích thường (không gồm phản biện và tách mẫu); chi phí và token vẫn tính đủ, chi phí phản biện được tách riêng.
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
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_timeseries(integer) to authenticated;
