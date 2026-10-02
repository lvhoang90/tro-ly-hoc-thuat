import { supabase } from "./supabase.ts";
import type { AnalysisResult, ApiError, Lang } from "../../shared/types.ts";

export class ApiFailure extends Error {
  constructor(public info: ApiError, public status: number) { super(info.error); }
}

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${await token()}` } });
  const body = await r.json().catch(() => ({ error: "ai_failed" }));
  if (!r.ok) throw new ApiFailure(body as ApiError, r.status);
  return body as T;
}

export const analyze = (p: { abstract: string; text: string; fileName: string; ui: Lang; fields?: string }) =>
  call<AnalysisResult>("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });

export const extractDoc = (file: File) =>
  call<{ text: string }>("/api/extract-doc", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });

export interface VisitStats { enabled: boolean; total?: number; today?: number; days?: { d: string; n: number }[]; countries?: { c: string; n: number }[] }
export async function visit(): Promise<VisitStats> {
  let first = false;
  try { first = !sessionStorage.getItem("tl-visit"); if (first) sessionStorage.setItem("tl-visit", "1"); } catch { /* bỏ qua */ }
  try { return await (await fetch("/api/visit", { method: first ? "POST" : "GET" })).json(); } catch { return { enabled: false }; }
}
