import { supabase } from "./supabase.ts";
import type { AnalysisResult, ApiError } from "../../shared/types.ts";

export class ApiFailure extends Error {
  constructor(public info: ApiError, public status: number) { super(info.error); }
}

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${await token()}` } });
  // Máy chủ sập hoặc hết thời gian chờ thì trả trang lỗi không phải JSON: báo riêng, không nói sai là đã hoàn lượt.
  const body = await r.json().catch(() => ({ error: "server_error", message: String(r.status) }));
  // Máy chủ Node giữ kết nối bằng khoảng trắng nên lỗi muộn vẫn trả mã 200: lỗi nằm trong thân (kèm `status`).
  const failed = body as ApiError & { status?: number };
  if (!r.ok || failed.error) throw new ApiFailure(failed, failed.status ?? r.status);
  return body as T;
}

export const analyze = (p: { abstract: string; text: string; fileName: string; profile?: string }) =>
  call<AnalysisResult>("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });

export const extractDoc = (file: File) =>
  call<{ text: string }>("/api/extract-doc", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });

export interface VisitStats { enabled: boolean; total?: number; today?: number; days?: { d: string; n: number }[]; countries?: { c: string; n: number }[] }
/** Ghi một lượt truy cập (mỗi phiên một lần) và trả thống kê; `days` là số ngày của chuỗi theo ngày. */
export async function visit(days = 30): Promise<VisitStats> {
  let first = false;
  try { first = !sessionStorage.getItem("tl-visit"); if (first) sessionStorage.setItem("tl-visit", "1"); } catch { /* bỏ qua */ }
  try { return await (await fetch(`/api/visit?days=${days}`, { method: first ? "POST" : "GET" })).json(); } catch { return { enabled: false }; }
}
