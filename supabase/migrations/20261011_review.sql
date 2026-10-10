-- Tính năng Phản biện học thuật. Chạy một lần trong Supabase → SQL Editor (chạy lại an toàn). Cần schema.sql, 20261004_tiers.sql, 20261010_ecosystem.sql đã chạy trước đó.
-- ---------- Phản biện học thuật: hạn mức riêng, tách khỏi lượt phân tích ----------
-- Chỉ người dùng đã xác thực (và quản trị viên) dùng được. Hạn mức theo tuần (giờ Việt Nam), do quản trị viên đặt.
alter table public.usage_log add column if not exists kind text not null default 'analyze' check (kind in ('analyze', 'review'));
alter table public.usage_log add column if not exists units_done integer not null default 0;
insert into public.app_settings(key, value) values ('review_weekly_limit', '2'::jsonb) on conflict (key) do nothing;

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
  if not found then return jsonb_build_object('eligible', false, 'limit', 0, 'used', 0, 'left', 0, 'unlimited', false); end if;
  lim := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'review_weekly_limit'), 2);
  select count(*)::int into used from public.usage_log
    where user_id = p_user and kind = 'review' and not refunded and (created_at at time zone 'Asia/Ho_Chi_Minh')::date >= ws;
  return jsonb_build_object(
    'eligible', (p.approved or p.role = 'admin'),
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

-- Cộng dồn chi phí API của từng phần (mỗi phần là một lần gọi AI); trả về số phần đã hoàn tất.
create or replace function public.add_usage(p_log bigint, p_model text, p_in integer, p_out integer, p_cost numeric, p_unit boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.usage_log set model = coalesce(nullif(p_model, ''), model),
    input_tokens = input_tokens + greatest(coalesce(p_in, 0), 0), output_tokens = output_tokens + greatest(coalesce(p_out, 0), 0),
    cost_usd = cost_usd + greatest(coalesce(p_cost, 0), 0), units_done = units_done + (case when p_unit then 1 else 0 end)
  where id = p_log and kind = 'review' returning units_done into n;
  return coalesce(n, 0);
end $$;

-- Kết thúc lượt phản biện thành công: ghi điểm đề xuất và trả thưởng giới thiệu (nếu có).
create or replace function public.finish_review(p_log bigint, p_score integer) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  update public.usage_log set score = p_score where id = p_log and kind = 'review' returning user_id into uid;
  if uid is not null and p_score is not null then perform public.pay_referral(uid); end if;
end $$;

revoke all on function public.review_quota_of(uuid) from public, anon, authenticated;
revoke all on function public.consume_review(uuid) from public, anon, authenticated;
revoke all on function public.refund_review(bigint) from public, anon, authenticated;
revoke all on function public.add_usage(bigint, text, integer, integer, numeric, boolean) from public, anon, authenticated;
revoke all on function public.finish_review(bigint, integer) from public, anon, authenticated;
grant execute on function public.review_quota_of(uuid) to service_role;
grant execute on function public.consume_review(uuid) to service_role;
grant execute on function public.refund_review(bigint) to service_role;
grant execute on function public.add_usage(bigint, text, integer, integer, numeric, boolean) to service_role;
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
