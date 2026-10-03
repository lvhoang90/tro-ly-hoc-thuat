-- Ngân sách API (số dư đã nhập, lịch sử nạp) và tổng chi từ một mốc thời gian.
-- Bảng admin_kv CHỈ quản trị viên đọc/ghi được. Không dùng app_settings vì bảng đó công khai (để hiện thông tin liên hệ).
-- An toàn khi chạy lại. Các lệnh này cũng đã nằm trong supabase/schema.sql.
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
