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

create table if not exists public.credit_grants (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  admin_id   uuid references public.profiles(id) on delete set null,
  amount     integer not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);

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
create index if not exists citations_user_idx on public.citations(user_id, created_at desc);

-- ---------- Cấu hình mặc định ----------
insert into public.app_settings(key, value) values
  ('free_daily_limit', '2'::jsonb),
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
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'free_daily_limit'), 2);
$$;

-- ---------- Tạo hồ sơ khi có tài khoản mới ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, role)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(new.email,''))) then 'admin' else 'user' end
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
  update public.profiles set role = 'admin' where lower(email) = lower(new.email);
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
  insert into public.usage_log(user_id, source) values (p_user, src);
  return jsonb_build_object('ok', true, 'source', src,
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

revoke all on function public.consume_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;

-- Hạn mức của chính người dùng đang đăng nhập.
create or replace function public.my_quota() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles%rowtype; lim integer := public.free_limit(); u integer;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select coalesce(used, 0) into u from public.usage_daily where user_id = p.id and day = public.vn_today();
  u := coalesce(u, 0);
  return jsonb_build_object(
    'role', p.role, 'status', p.status, 'unlimited', p.role = 'admin',
    'free_limit', lim, 'used_today', u, 'free_left', greatest(lim - u, 0),
    'bonus', p.bonus_credits, 'lifetime_used', p.lifetime_used);
end $$;
grant execute on function public.my_quota() to authenticated;

-- ---------- Quản trị ----------
create or replace function public.admin_list_users(p_search text default '', p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, email text, full_name text, affiliation text, orcid text, role text, status text,
  bonus_credits int, lifetime_used int, used_today int, created_at timestamptz, last_seen timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, p.affiliation, p.orcid, p.role, p.status,
           p.bonus_credits, p.lifetime_used,
           coalesce(ud.used, 0), p.created_at, p.last_seen,
           count(*) over()
    from public.profiles p
    left join public.usage_daily ud on ud.user_id = p.id and ud.day = public.vn_today()
    where p_search = '' or p.email ilike '%'||p_search||'%' or p.full_name ilike '%'||p_search||'%'
       or p.orcid ilike '%'||p_search||'%' or p.affiliation ilike '%'||p_search||'%'
    order by p.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

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

create or replace function public.admin_set_user(p_user uuid, p_role text default null, p_status text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() and (p_role = 'user' or p_status = 'suspended') then
    raise exception 'cannot demote or suspend yourself';
  end if;
  update public.profiles set
    role = coalesce(p_role, role), status = coalesce(p_status, status)
  where id = p_user;
end $$;
grant execute on function public.admin_set_user(uuid, text, text) to authenticated;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'analyses_today', (select count(*) from public.usage_log where not refunded and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.vn_today()),
    'analyses_7d', (select count(*) from public.usage_log where not refunded and created_at > now() - interval '7 days'),
    'analyses_total', (select count(*) from public.usage_log where not refunded),
    'citations_total', (select count(*) from public.citations),
    'bonus_outstanding', (select coalesce(sum(bonus_credits), 0) from public.profiles),
    'exhausted_today', (select count(*) from public.usage_daily d join public.profiles p on p.id = d.user_id
                        where d.day = public.vn_today() and d.used >= public.free_limit() and p.bonus_credits = 0 and p.role = 'user')
  ) into r;
  return r;
end $$;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_key not in ('free_daily_limit', 'contact') then raise exception 'unknown setting'; end if;
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

-- Người dùng chỉ được sửa các cột hồ sơ học thuật; không tự đổi role, status, hạn mức.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, title, affiliation, department, position, country, orcid, research_fields,
              keywords, bio, website, scholar_url, scopus_id, phone, updated_at)
  on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- ---------- Quản trị viên master ----------
-- Thay bằng email của bạn rồi chạy lại. Tài khoản đăng ký bằng email này sẽ là master (không giới hạn lượt).
-- insert into public.admin_emails(email) values ('ban@example.com') on conflict do nothing;
