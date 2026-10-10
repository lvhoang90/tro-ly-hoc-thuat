import { buildIndex, countWords, verifyEvidence, type Block } from "./corpus.ts";
import { DECISIONS, DOC_TYPES, ROLES, UNSCORED, computeScore, decide, decisionFromScore, defaultRubric, type Decision, type Evidence } from "./rubric.ts";
import { usesDefaultRubric, type Template, type TemplateSection } from "./template.ts";
import type { ReviewMeta } from "./prompts.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

export interface ReviewSection extends TemplateSection {
  missing: boolean; content: string; strengths: string[]; weaknesses: string[];
  revisions: { priority: string; action: string }[]; evidence: Evidence[]; points: number; point_rationale: string; insufficient_basis: boolean;
}
export interface ReviewResult {
  generatedAt: string; model: string;
  meta: { docType: string; docTypeLabel: string; role: string; roleLabel: string; field: string; notes: string };
  template: { title: string; language: string; purpose: string; scale_total: number; scoring_notes: string };
  file: { name: string; words: number; pages?: number };
  profile: { title?: string; author?: string; field?: string; type_detected?: string; completeness?: string };
  info: { label: string; value: string }[];
  sections: ReviewSection[];
  score: { scheme: "default" | "template"; rows: { id?: string; label?: string; max: number; points: number; rationale?: string; evidence?: Evidence[] }[]; sum: number; sumMax: number; score100: number };
  decision: Decision & { mismatch: { model: string; modelLabel?: string; scoreBased: string } | null };
  fatalDefects: { severity: "fatal" | "serious"; description: string; evidence: Evidence[] }[];
  integrityNotes: { concern: string; suggested_check: string; evidence: Evidence[] }[];
  overall: { summary: string; mainStrengths: string[]; mainWeaknesses: string[]; conclusion: string };
  questions: string[]; limitations: string[]; warnings: string[];
  verification: { kept: number; dropped: number };
}

/** Ghép các phần AI trả về thành bản nhận xét hoàn chỉnh: đối chiếu từng trích dẫn với bản gốc, tính điểm và khuyến nghị bằng mã. */
export function assemble(p: { sections: Raw[]; overall: Raw; template: Template; blocks: Block[]; meta: ReviewMeta; fileName: string; model: string }): ReviewResult {
  const { template, meta } = p;
  const index = buildIndex(p.blocks);
  const rubric = usesDefaultRubric(template) ? defaultRubric(meta.docType) : null;
  const o = p.overall ?? {};
  let kept = 0, dropped = 0;
  const ver = (ev: any): Evidence[] => {
    const r = verifyEvidence(index, Array.isArray(ev) ? ev : []);
    kept += r.kept.length; dropped += r.dropped;
    return r.kept;
  };
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);

  const byId = new Map<string, Raw>((p.sections ?? []).map((s) => [s?.section_id, s]));
  const warnings: string[] = [];
  const sections: ReviewSection[] = template.sections.map((ts) => {
    const r = byId.get(ts.id);
    if (!r) {
      warnings.push(`Mục "${ts.title}" chưa được AI trả lời; cần người phản biện tự nhận xét.`);
      return { ...ts, missing: true, content: "", strengths: [], weaknesses: [], revisions: [], evidence: [], points: 0, point_rationale: "", insufficient_basis: true };
    }
    return {
      ...ts, missing: false, content: String(r.content ?? ""), strengths: arr(r.strengths), weaknesses: arr(r.weaknesses),
      revisions: (Array.isArray(r.revisions) ? r.revisions : []).map((x: Raw) => ({ priority: String(x?.priority ?? "goi_y"), action: String(x?.action ?? "") })),
      evidence: ver(r.evidence), points: Number(r.points) || 0, point_rationale: String(r.point_rationale ?? ""), insufficient_basis: !!r.insufficient_basis,
    };
  });

  let items;
  if (rubric) {
    const by = new Map<string, Raw>((o.rubric_scores ?? []).map((x: Raw) => [x?.criterion_id, x]));
    items = [];
    for (const c of rubric) {
      const x = by.get(c.id);
      if (!x) { warnings.push(`Tiêu chí "${c.label}" chưa được chấm; đã loại khỏi tổng điểm.`); continue; }
      items.push({ id: c.id, label: c.label, max: c.max, points: Number(x.points), rationale: String(x.rationale ?? ""), evidence: ver(x.evidence) });
    }
  } else {
    items = sections.filter((s) => s.max_points > 0 && !s.missing).map((s) => ({ id: s.id, label: `${s.number} ${s.title}`.trim(), max: s.max_points, points: s.points, rationale: s.point_rationale, evidence: [] as Evidence[] }));
    for (const s of sections) if (s.max_points > 0 && s.missing) warnings.push(`Mục "${s.title}" có điểm nhưng chưa được chấm; đã loại khỏi tổng điểm.`);
  }
  const sc = computeScore(items);
  if (sc.sumMax === 0) warnings.push("Không tính được điểm tổng do thiếu điểm thành phần.");

  const fatal = (o.fatal_defects ?? []).map((d: Raw) => ({ severity: d?.severity === "fatal" ? "fatal" as const : "serious" as const, description: String(d?.description ?? ""), evidence: ver(d?.evidence) }));
  const integrity = (o.integrity_notes ?? []).map((n: Raw) => ({ concern: String(n?.concern ?? ""), suggested_check: String(n?.suggested_check ?? ""), evidence: ver(n?.evidence) }));
  const decision = sc.sumMax ? decide(sc.score100, fatal) : UNSCORED;
  const modelDecision = o.overall?.proposed_decision as keyof typeof DECISIONS | undefined;
  const mismatch = modelDecision && modelDecision !== decision.key
    ? { model: modelDecision, modelLabel: DECISIONS[modelDecision]?.short, scoreBased: decisionFromScore(sc.score100) } : null;
  const ov = o.overall ?? {};
  const pages = p.blocks.reduce((m, b) => Math.max(m, b.page ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(), model: p.model,
    meta: { docType: meta.docType, docTypeLabel: DOC_TYPES[meta.docType as keyof typeof DOC_TYPES] ?? DOC_TYPES.other, role: meta.role, roleLabel: ROLES[meta.role as keyof typeof ROLES] ?? ROLES.other, field: meta.field ?? "", notes: meta.notes ?? "" },
    template: { title: template.template_title, language: template.language, purpose: template.purpose, scale_total: template.scale_total, scoring_notes: template.scoring_notes },
    file: { name: p.fileName, words: countWords(p.blocks), ...(pages ? { pages } : {}) },
    profile: o.document_profile ?? {},
    info: (o.info_values ?? []).map((x: Raw) => ({ label: String(x?.label ?? ""), value: String(x?.value ?? "") })),
    sections,
    score: { scheme: rubric ? "default" : "template", rows: sc.rows, sum: sc.sum, sumMax: sc.sumMax, score100: sc.score100 },
    decision: { ...decision, mismatch },
    fatalDefects: fatal, integrityNotes: integrity,
    overall: { summary: String(ov.summary ?? ""), mainStrengths: arr(ov.main_strengths), mainWeaknesses: arr(ov.main_weaknesses), conclusion: String(ov.conclusion_text ?? "") },
    questions: arr(o.questions_for_author), limitations: arr(o.limitations), warnings,
    verification: { kept, dropped },
  };
}

/** Tóm tắt nhận xét các mục để đưa vào bước tổng hợp (không kèm bằng chứng, để nhẹ). */
export function sectionDigest(template: Template, sections: Raw[]): string {
  const by = new Map<string, Raw>(sections.map((s) => [s?.section_id, s]));
  return template.sections.map((ts) => {
    const r = by.get(ts.id);
    if (!r) return `${ts.number} ${ts.title}: (chưa có)`;
    const pts = ts.max_points > 0 ? ` | điểm ${r.points}/${ts.max_points}` : "";
    return `${ts.number} ${ts.title}${pts}\n  Ưu điểm: ${(r.strengths ?? []).join("; ") || "—"}\n  Hạn chế: ${(r.weaknesses ?? []).join("; ") || "—"}${r.insufficient_basis ? "\n  (chưa đủ cơ sở đánh giá)" : ""}`;
  }).join("\n");
}
