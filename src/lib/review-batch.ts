// Chấm lô nhiều công trình của nhiều người: mỗi tệp là một công trình riêng, xử lý TUẦN TỰ, mỗi công trình một lượt phản biện
// và một bản nhận xét riêng. Một công trình lỗi không làm dừng các công trình khác; hết hạn mức hoặc mất quyền thì dừng cả lô.
import type { RawBlock } from "../../shared/review/corpus.ts";

export type ItemStatus = "reading" | "ready" | "read_error" | "queued" | "running" | "done" | "failed" | "skipped" | "stopped";
export interface WorkItem {
  id: string; name: string; size: number;
  blocks?: RawBlock[]; words?: number; pages?: number;
  status: ItemStatus; error?: string; stage?: unknown; savedId?: string;
}

/** Mã lỗi buộc dừng cả lô (không phải lỗi riêng của một công trình). */
export const BATCH_STOP_CODES = new Set(["quota_exhausted", "review_locked", "suspended", "unauthorized", "not_verified", "email_unverified"]);

export interface BatchDeps {
  /** Chạy một công trình; trả về mã bản đã lưu. Ném lỗi nếu thất bại (lượt đã được hoàn nếu chưa có phần nào xong). */
  run: (item: WorkItem, onStage: (s: unknown) => void) => Promise<{ savedId: string }>;
  onChange: (item: WorkItem) => void;
  /** Người dùng bấm "Dừng sau công trình này". */
  shouldStop: () => boolean;
  /** Đổi lỗi thành mã và thông điệp hiển thị. */
  classify: (e: unknown) => { code: string; message: string };
}

export interface BatchSummary { done: number; failed: number; skipped: number; stopped: number; stoppedBecause?: string }

export async function runBatch(items: WorkItem[], d: BatchDeps): Promise<BatchSummary> {
  const sum: BatchSummary = { done: 0, failed: 0, skipped: 0, stopped: 0 };
  const set = (it: WorkItem, patch: Partial<WorkItem>) => { Object.assign(it, patch); d.onChange({ ...it }); };
  items.forEach((it) => set(it, { status: "queued", error: undefined, stage: undefined }));
  let halt = "";
  for (const it of items) {
    if (halt) { set(it, { status: "skipped", error: halt }); sum.skipped++; continue; }
    if (d.shouldStop()) { set(it, { status: "stopped" }); sum.stopped++; continue; }
    set(it, { status: "running" });
    try {
      const { savedId } = await d.run(it, (s) => set(it, { stage: s }));
      set(it, { status: "done", savedId, stage: undefined }); sum.done++;
    } catch (e) {
      const c = d.classify(e);
      set(it, { status: "failed", error: c.message, stage: undefined }); sum.failed++;
      if (BATCH_STOP_CODES.has(c.code)) { halt = c.message; sum.stoppedBecause = c.code; }
    }
  }
  return sum;
}
