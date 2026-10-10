-- Hệ sinh thái ISA: giới thiệu đồng nghiệp bằng liên kết cá nhân (?ref=). Chạy một lần trong Supabase → SQL Editor (chạy lại an toàn).
-- Cần schema.sql và 20261004_tiers.sql đã chạy trước đó.
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
revoke all on function public.pay_referral(uuid) from public, anon, authenticated;
grant execute on function public.pay_referral(uuid) to service_role;
revoke all on function public.record_usage(bigint, text, integer, integer, numeric, integer) from public, anon, authenticated;
grant execute on function public.record_usage(bigint, text, integer, integer, numeric, integer) to service_role;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_key not in ('free_daily_limit', 'contact', 'file_limit_basic_mb', 'file_limit_approved_mb', 'usd_vnd', 'basic_weekly_limit', 'tier_start', 'referral_bonus', 'referral_cap') then raise exception 'unknown setting'; end if;
  if p_key = 'tier_start' and (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date'; end if;
  insert into public.app_settings(key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
end $$;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

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
