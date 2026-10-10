// Tải chỉ mục công khai của ProFind một lần cho mỗi phiên (khoảng 1,5 MB, trình duyệt giữ bộ nhớ đệm 1 giờ).
// Chỉ tải khi cần (xem tác giả của tài liệu hoặc hồ sơ ProFind của bạn); không gửi gì về người dùng sang ProFind.
import { useEffect, useState } from "react";
import { PROFIND_INDEX_URL, type Idx } from "../../shared/profind.ts";

let pending: Promise<Idx> | null = null;
export function loadProfindIndex(): Promise<Idx> {
  pending ??= fetch(PROFIND_INDEX_URL, { credentials: "omit", referrerPolicy: "origin" })
    .then((r) => { if (!r.ok) throw new Error(`profind ${r.status}`); return r.json() as Promise<Idx>; })
    .catch((e) => { pending = null; throw e; });
  return pending;
}

export type IndexState = { status: "loading" } | { status: "error" } | { status: "ready"; idx: Idx };
export function useProfindIndex(enabled = true): IndexState {
  const [s, setS] = useState<IndexState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadProfindIndex().then((idx) => live && setS({ status: "ready", idx }), () => live && setS({ status: "error" }));
    return () => { live = false; };
  }, [enabled]);
  return s;
}
