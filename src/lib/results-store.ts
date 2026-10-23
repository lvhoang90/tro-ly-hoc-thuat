// Kết quả phân tích và phản biện lưu trên tài khoản (bảng saved_results) để xem lại và tải lại từ mọi máy.
// Chỉ lưu kết quả, không lưu tệp hay toàn văn. Mọi thao tác "cố gắng hết sức": lỗi mạng hoặc chưa chạy migration thì trả null/false,
// ứng dụng vẫn chạy bình thường với bản lưu trên trình duyệt.
import type { ResultMeta } from "../../shared/review/saved.ts";
import { supabase } from "./supabase.ts";

export type Kind = "analysis" | "review";
interface Row { local_id: string; name: string; score: number | null; label: string; created_at: string }
const toMeta = (r: Row): ResultMeta => ({ id: r.local_id, at: r.created_at, name: r.name, score: r.score, label: r.label });

/** Danh sách (không kèm nội dung), mới nhất trước. null nếu chưa lấy được. */
export async function listCloud(kind: Kind): Promise<ResultMeta[] | null> {
  try {
    const { data, error } = await supabase.from("saved_results").select("local_id,name,score,label,created_at").eq("kind", kind).order("created_at", { ascending: false }).limit(200);
    if (error || !Array.isArray(data)) return null;
    return (data as Row[]).map(toMeta);
  } catch { return null; }
}

export async function getCloud<T>(kind: Kind, id: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.from("saved_results").select("payload").eq("kind", kind).eq("local_id", id).maybeSingle();
    return error || !data ? null : ((data as { payload: T }).payload ?? null);
  } catch { return null; }
}

/** Lưu hoặc cập nhật một bản (theo mã); true nếu thành công. */
export async function putCloud(userId: string, kind: Kind, m: ResultMeta, payload: unknown): Promise<boolean> {
  try {
    const { error } = await supabase.from("saved_results").upsert(
      { user_id: userId, kind, local_id: m.id, name: m.name.slice(0, 300), score: m.score == null ? null : Math.max(0, Math.min(100, Math.round(m.score))), label: m.label.slice(0, 60), payload, created_at: m.at },
      { onConflict: "user_id,kind,local_id" });
    return !error;
  } catch { return false; }
}

export async function delCloud(kind: Kind, id: string): Promise<boolean> {
  try { const { error } = await supabase.from("saved_results").delete().eq("kind", kind).eq("local_id", id); return !error; } catch { return false; }
}
export async function clearCloud(kind: Kind): Promise<boolean> {
  try { const { error } = await supabase.from("saved_results").delete().eq("kind", kind); return !error; } catch { return false; }
}

/** Số bản đã lưu (kể cả khi hạng Cơ bản chưa xem được danh sách phân tích). */
export async function countCloud(kind: Kind): Promise<number | null> {
  try { const { data, error } = await supabase.rpc("my_saved_count", { p_kind: kind }); return error ? null : Number(data) || 0; } catch { return null; }
}

export async function setSavePref(userId: string, on: boolean): Promise<boolean> {
  try { const { error } = await supabase.from("profiles").update({ save_results: on }).eq("id", userId); return !error; } catch { return false; }
}

/** Người dùng đang bật lưu kết quả vào tài khoản (mặc định bật; cột chưa có thì coi là bật). */
export const savesToCloud = (p: { save_results?: boolean } | null | undefined) => !!p && p.save_results !== false;
