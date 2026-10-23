-- Lưu kết quả phân tích và phản biện vào tài khoản để xem lại và tải lại từ mọi máy. Chạy một lần trong Supabase → SQL Editor (chạy lại an toàn).
-- Chỉ lưu KẾT QUẢ (điểm, nhận xét, đoạn trích, gợi ý), không lưu tệp và không lưu toàn văn tài liệu. Người dùng tắt được bằng cột save_results.
alter table public.profiles add column if not exists save_results boolean not null default true;
grant update (save_results) on public.profiles to authenticated;

create table if not exists public.saved_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('analysis', 'review')),
  local_id   text not null check (char_length(local_id) between 1 and 80),
  name       text not null default '' check (char_length(name) <= 300),
  score      integer check (score is null or (score >= 0 and score <= 100)),
  label      text not null default '' check (char_length(label) <= 60),
  payload    jsonb not null check (pg_column_size(payload) <= 3000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, local_id)
);
create index if not exists saved_results_user_idx on public.saved_results(user_id, kind, created_at desc);

alter table public.saved_results enable row level security;
revoke all on public.saved_results from anon;
grant select, insert, update, delete on public.saved_results to authenticated;

-- Phân tích thường theo cùng quy tắc xem lịch sử (hạng Cơ bản bị giới hạn); bản phản biện luôn xem được của chính mình.
drop policy if exists saved_results_select on public.saved_results;
drop policy if exists saved_results_insert on public.saved_results;
drop policy if exists saved_results_update on public.saved_results;
drop policy if exists saved_results_delete on public.saved_results;
create policy saved_results_select on public.saved_results for select using (user_id = auth.uid() and (kind = 'review' or public.can_view_history()));
create policy saved_results_insert on public.saved_results for insert with check (user_id = auth.uid());
create policy saved_results_update on public.saved_results for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_results_delete on public.saved_results for delete using (user_id = auth.uid());

-- Cập nhật giờ sửa; giữ tối đa 100 bản mới nhất mỗi loại cho mỗi người.
create or replace function public.saved_results_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists saved_results_touch on public.saved_results;
create trigger saved_results_touch before update on public.saved_results for each row execute function public.saved_results_touch();

create or replace function public.saved_results_trim() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.saved_results where id in (
    select id from public.saved_results where user_id = new.user_id and kind = new.kind order by created_at desc offset 100
  );
  return null;
end $$;
drop trigger if exists saved_results_trim on public.saved_results;
create trigger saved_results_trim after insert on public.saved_results for each row execute function public.saved_results_trim();

-- Số bản đã lưu của chính người dùng (kể cả khi hạng Cơ bản chưa xem được danh sách phân tích).
create or replace function public.my_saved_count(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.saved_results where user_id = auth.uid() and kind = p_kind;
$$;
grant execute on function public.my_saved_count(text) to authenticated;
