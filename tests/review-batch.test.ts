import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { assemble } from "../shared/review/assemble.ts";
import { numberBlocks } from "../shared/review/corpus.ts";
import { linesToList, listToLines, recompute, setRowPoints } from "../shared/review/edit.ts";
import { builtinTemplate, normalizeTemplate } from "../shared/review/template.ts";
import { BATCH_STOP_CODES, runBatch, type WorkItem } from "../src/lib/review-batch.ts";
import { buildZip, exportFileName } from "../src/lib/review-docx.ts";

const blocks = numberBlocks([{ kind: "p", text: "Nghiên cứu khảo sát 120 học sinh trung học phổ thông tại một trường." }]);
const meta = { docType: "thesis", role: "reviewer", field: "", notes: "", lang: "vi" as const };

function make(name: string, scores: number[], fatal = false) {
  const t = builtinTemplate("thesis");
  const rubric = t.sections.slice(0, -1).map((_, i) => `c${i + 1}`);
  void rubric;
  return assemble({
    sections: t.sections.map((s) => ({ section_id: s.id, content: `Nhận xét ${s.title}`, strengths: ["a"], weaknesses: ["b"], revisions: [], evidence: [], points: 0 })),
    overall: {
      rubric_scores: scores.map((p, i) => ({ criterion_id: `c${i + 1}`, points: p, rationale: "", evidence: [] })),
      fatal_defects: fatal ? [{ severity: "fatal", description: "x", evidence: [] }] : [],
      overall: { summary: "S", conclusion_text: "C", proposed_decision: "accept" },
    },
    template: t, blocks, meta, fileName: name, model: "test",
  });
}
// thang mặc định luận văn: 15+15+20+20+15+5+10 = 100
const FULL = [15, 15, 20, 20, 15, 5, 10];

test("sửa điểm: tổng điểm, khuyến nghị và cảnh báo dưới 60 được tính lại", () => {
  const r = make("a.docx", FULL);
  assert.equal(r.score.score100, 100);
  assert.equal(r.decision.key, "accept");
  let e = setRowPoints(r, 2, 0);          // tiêu chí phương pháp 20 → 0
  e = setRowPoints(e, 3, 0);              // kết quả 20 → 0
  assert.equal(e.score.sum, 60);
  assert.equal(e.score.score100, 60);
  assert.equal(e.decision.key, "accept_with_conditions");
  e = setRowPoints(e, 0, 0); e = setRowPoints(e, 1, 0);
  assert.equal(e.score.score100, 30);
  assert.equal(e.decision.key, "reject");
  assert.ok(e.decision.belowPass);
  assert.equal(r.score.score100, 100, "bản gốc không bị sửa tại chỗ");
});

test("sửa điểm: kẹp trong 0..tối đa; khuyết điểm rất nghiêm trọng vẫn hạ khuyến nghị", () => {
  const r = make("a.docx", FULL, true);
  assert.equal(r.decision.key, "major_revision");
  const e = setRowPoints(r, 0, 99);
  assert.equal(e.score.rows[0].points, 15);
  assert.equal(setRowPoints(e, 0, -5).score.rows[0].points, 0);
  assert.equal(setRowPoints(e, 0, Number.NaN).score.rows[0].points, 0);
  assert.equal(recompute(e).decision.key, "major_revision");
  assert.equal(setRowPoints(e, 42, 1), e, "dòng không tồn tại: giữ nguyên");
});

test("điểm theo mẫu: sửa dòng bảng điểm đồng bộ điểm của mục", () => {
  const t = normalizeTemplate({ template_title: "M", sections: [{ title: "A", kind: "scored", max_points: 4 }, { title: "B", kind: "scored", max_points: 6 }] });
  const r = assemble({ sections: t.sections.map((s) => ({ section_id: s.id, content: "x", evidence: [], points: s.max_points })), overall: {}, template: t, blocks, meta, fileName: "b.docx", model: "t" });
  assert.equal(r.score.scheme, "template");
  assert.equal(r.score.score100, 100);
  const e = setRowPoints(r, 1, 3);
  assert.equal(e.sections[1].points, 3);
  assert.equal(e.score.score100, 70);
});

test("danh sách ý ↔ mỗi dòng một ý", () => {
  assert.deepEqual(linesToList(" a \n\n b\n"), ["a", "b"]);
  assert.equal(listToLines(["a", "b"]), "a\nb");
});

const item = (name: string): WorkItem => ({ id: name, name, size: 1, status: "ready" });
const classify = (e: unknown) => ({ code: (e as { code?: string }).code ?? "", message: (e as Error).message });

test("lô: tuần tự theo thứ tự, mỗi công trình một bản riêng; lỗi một công trình không dừng các công trình khác", async () => {
  const order: string[] = [];
  const seen: Record<string, string> = {};
  const items = ["A.docx", "B.docx", "C.docx"].map(item);
  const sum = await runBatch(items, {
    run: async (it, onStage) => {
      order.push(`+${it.name}`); onStage({ phase: "start" });
      await new Promise((r) => setTimeout(r, 5));
      if (it.name === "B.docx") throw Object.assign(new Error("AI lỗi"), { code: "ai_failed" });
      order.push(`-${it.name}`); return { savedId: `id-${it.name}` };
    },
    onChange: (x) => { seen[x.name] = x.status; },
    shouldStop: () => false, classify,
  });
  assert.deepEqual(order, ["+A.docx", "-A.docx", "+B.docx", "+C.docx", "-C.docx"], "không chạy song song");
  assert.deepEqual(items.map((x) => x.status), ["done", "failed", "done"]);
  assert.deepEqual(items.map((x) => x.savedId), ["id-A.docx", undefined, "id-C.docx"]);
  assert.equal(items[1].error, "AI lỗi");
  assert.deepEqual([sum.done, sum.failed, sum.skipped], [2, 1, 0]);
  assert.equal(seen["C.docx"], "done");
});

test("lô: hết hạn mức giữa chừng thì các công trình còn lại được bỏ qua kèm lý do", async () => {
  const items = ["A", "B", "C", "D"].map(item);
  const sum = await runBatch(items, {
    run: async (it) => { if (it.name === "B") throw Object.assign(new Error("Hết lượt tuần này"), { code: "quota_exhausted" }); return { savedId: it.name }; },
    onChange: () => {}, shouldStop: () => false, classify,
  });
  assert.deepEqual(items.map((x) => x.status), ["done", "failed", "skipped", "skipped"]);
  assert.equal(items[2].error, "Hết lượt tuần này");
  assert.equal(sum.stoppedBecause, "quota_exhausted");
  assert.ok(BATCH_STOP_CODES.has("review_locked") && !BATCH_STOP_CODES.has("ai_failed") && !BATCH_STOP_CODES.has("review_limit"));
});

test("lô: bấm dừng thì hoàn tất công trình đang chạy rồi dừng các công trình sau", async () => {
  let stop = false;
  const items = ["A", "B", "C"].map(item);
  const sum = await runBatch(items, {
    run: async (it) => { if (it.name === "A") stop = true; return { savedId: it.name }; },
    onChange: () => {}, shouldStop: () => stop, classify,
  });
  assert.deepEqual(items.map((x) => x.status), ["done", "stopped", "stopped"]);
  assert.equal(sum.stopped, 2);
});

test("gói .zip: mỗi công trình một .docx riêng, tên theo tệp gốc, tên trùng được đánh số", async () => {
  const a = make("Nguyễn Văn A - đề cương.docx", FULL);
  const b = make("Trần Thị B - đề cương.pdf", [10, 10, 10, 10, 10, 3, 5]);
  const c = make("Nguyễn Văn A - đề cương.docx", FULL);
  const zip = await JSZip.loadAsync(await (await buildZip([a, b, c])).arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), ["Nhan-xet - Nguyễn Văn A - đề cương (2).docx", "Nhan-xet - Nguyễn Văn A - đề cương.docx", "Nhan-xet - Trần Thị B - đề cương.docx"]);
  assert.equal(exportFileName(b, "en"), "Review - Trần Thị B - đề cương.docx");
  for (const f of Object.values(zip.files)) {
    const head = await f.async("uint8array");
    assert.equal(String.fromCharCode(head[0], head[1]), "PK", "mỗi tệp trong gói là một .docx hợp lệ (zip)");
  }
});
