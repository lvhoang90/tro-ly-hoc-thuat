-- =====================================================================
-- Trợ lý học thuật | AI Academic Agent 1.0 - lược đồ Supabase (Postgres)
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

-- ---------- Tạo hồ sơ khi có tài khoản mới ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean := exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(new.email,'')));
begin
  insert into public.profiles(id, email, full_name, role, approved)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when adm then 'admin' else 'user' end, adm
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

-- ---------- Hạn mức (chỉ máy chủ gọi bằng service_role) ----------
-- Trả về jsonb: { ok, source, reason, free_left, bonus }
create or replace function public.consume_credit(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  lim integer := public.free_limit();
  d date := public.vn_today();
  used_now integer;
  src text;
  lid bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;

  insert into public.usage_daily(user_id, day, used) values (p_user, d, 0) on conflict do nothing;
  select used into used_now from public.usage_daily where user_id = p_user and day = d for update;

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

-- Ghi chi phí API thực tế của một lượt (kể cả lượt bị hoàn lại vì AI lỗi: tiền token vẫn đã tiêu).
create or replace function public.record_usage(p_log bigint, p_model text, p_in integer, p_out integer, p_cost numeric, p_score integer)
returns void language sql security definer set search_path = public as $$
  update public.usage_log set model = coalesce(p_model, ''), input_tokens = greatest(coalesce(p_in, 0), 0),
    output_tokens = greatest(coalesce(p_out, 0), 0), cost_usd = greatest(coalesce(p_cost, 0), 0), score = p_score
  where id = p_log;
$$;

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
grant execute on function public.record_visit(text) to service_role;
grant execute on function public.visit_stats(integer) to service_role;

revoke all on function public.consume_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;

-- Hạn mức của chính người dùng đang đăng nhập.
create or replace function public.my_quota() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles%rowtype; lim integer := public.free_limit(); u integer; mb integer;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select coalesce(used, 0) into u from public.usage_daily where user_id = p.id and day = public.vn_today();
  u := coalesce(u, 0);
  mb := public.file_limit_mb(p.approved or p.role = 'admin');
  return jsonb_build_object(
    'role', p.role, 'status', p.status, 'unlimited', p.role = 'admin', 'approved', p.approved or p.role = 'admin',
    'max_file_mb', mb,
    'free_limit', lim, 'used_today', u, 'free_left', greatest(lim - u, 0),
    'bonus', p.bonus_credits, 'lifetime_used', p.lifetime_used);
end $$;
grant execute on function public.my_quota() to authenticated;

-- ---------- Quản trị ----------
drop function if exists public.admin_list_users(text, int, int);
create or replace function public.admin_list_users(p_search text default '', p_limit int default 50, p_offset int default 0, p_pending boolean default false)
returns table (
  id uuid, email text, full_name text, affiliation text, orcid text, role text, status text, approved boolean,
  bonus_credits int, lifetime_used int, used_today int, cost_usd numeric, created_at timestamptz, last_seen timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, p.affiliation, p.orcid, p.role, p.status, p.approved or p.role = 'admin',
           p.bonus_credits, p.lifetime_used,
           coalesce(ud.used, 0), coalesce((select sum(l.cost_usd) from public.usage_log l where l.user_id = p.id), 0),
           p.created_at, p.last_seen,
           count(*) over()
    from public.profiles p
    left join public.usage_daily ud on ud.user_id = p.id and ud.day = public.vn_today()
    where (p_search = '' or p.email ilike '%'||p_search||'%' or p.full_name ilike '%'||p_search||'%'
       or p.orcid ilike '%'||p_search||'%' or p.affiliation ilike '%'||p_search||'%')
      and (not p_pending or (not p.approved and p.role <> 'admin'))
    order by p.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;
grant execute on function public.admin_list_users(text, int, int, boolean) to authenticated;

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
    'analyses_today', (select count(*) from public.usage_log where not refunded and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.vn_today()),
    'analyses_7d', (select count(*) from public.usage_log where not refunded and created_at > now() - interval '7 days'),
    'analyses_total', (select count(*) from public.usage_log where not refunded),
    'refunded_total', (select count(*) from public.usage_log where refunded),
    'citations_total', (select count(*) from public.citations),
    'bonus_outstanding', (select coalesce(sum(bonus_credits), 0) from public.profiles),
    'exhausted_today', (select count(*) from public.usage_daily d join public.profiles p on p.id = d.user_id
                        where d.day = public.vn_today() and d.used >= public.free_limit() and p.bonus_credits = 0 and p.role = 'user'),
    'cost_total', (select coalesce(sum(cost_usd), 0) from public.usage_log),
    'cost_today', (select coalesce(sum(cost_usd), 0) from public.usage_log where (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.vn_today()),
    'cost_30d', (select coalesce(sum(cost_usd), 0) from public.usage_log where created_at > now() - interval '30 days'),
    'cost_refunded', (select coalesce(sum(cost_usd), 0) from public.usage_log where refunded),
    'tokens_in', (select coalesce(sum(input_tokens), 0) from public.usage_log),
    'tokens_out', (select coalesce(sum(output_tokens), 0) from public.usage_log)
  ) into r;
  return r;
end $$;

-- Chuỗi thời gian theo ngày (giờ Việt Nam) cho biểu đồ quản trị.
create or replace function public.admin_timeseries(p_days integer default 30)
returns table (day date, analyses integer, refunded integer, cost_usd numeric, input_tokens bigint, output_tokens bigint, new_users integer, citations integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select g::date,
      coalesce((select count(*) from public.usage_log l where not l.refunded and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select count(*) from public.usage_log l where l.refunded and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select sum(l.cost_usd) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0),
      coalesce((select sum(l.input_tokens) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::bigint,
      coalesce((select sum(l.output_tokens) from public.usage_log l where (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::bigint,
      coalesce((select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int,
      coalesce((select count(*) from public.citations c where (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g::date), 0)::int
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

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_key not in ('free_daily_limit', 'contact', 'file_limit_basic_mb', 'file_limit_approved_mb', 'usd_vnd') then raise exception 'unknown setting'; end if;
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
create policy citations_all on public.citations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

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

-- ---------- Quản trị viên master ----------
-- Thay bằng email của bạn rồi chạy lại. Tài khoản đăng ký bằng email này sẽ là master (không giới hạn lượt).
-- insert into public.admin_emails(email) values ('ban@example.com') on conflict do nothing;
