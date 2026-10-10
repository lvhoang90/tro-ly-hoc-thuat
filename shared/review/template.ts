import { defaultRubric, labelsFor, type Lang } from "./rubric.ts";

export type SectionKind = "narrative" | "scored" | "checklist" | "conclusion";
export interface TemplateSection { id: string; number: string; title: string; level: number; kind: SectionKind; guidance: string; max_points: number }
export interface Template {
  template_title: string; language: "vi" | "en"; purpose: string;
  info_fields: { label: string; fill_from_document: boolean }[];
  sections: TemplateSection[]; scale_total: number; scoring_notes: string; ambiguities: string[];
}

export const MAX_SECTIONS = 40;

/** Chuẩn hóa khung mẫu (do mô hình tách hoặc do người dùng gửi lên): đánh lại mã mục, kẹp giá trị, bỏ mục rỗng. */
export type TemplateInput = Partial<Omit<Template, "sections">> & { sections?: Partial<TemplateSection>[] };

export function normalizeTemplate(t: TemplateInput): Template {
  const kinds = new Set(["narrative", "scored", "checklist", "conclusion"]);
  const sections: TemplateSection[] = (t.sections ?? [])
    .filter((s) => s && String(s.title ?? "").trim())
    .slice(0, MAX_SECTIONS)
    .map((s, i) => ({
      id: `s${i + 1}`,
      number: String(s.number ?? "").slice(0, 12),
      title: String(s.title).trim().slice(0, 300),
      level: Math.min(3, Math.max(1, Number(s.level) || 1)),
      kind: (kinds.has(String(s.kind)) ? s.kind : "narrative") as SectionKind,
      guidance: String(s.guidance ?? "").slice(0, 1500),
      max_points: Math.max(0, Number(s.max_points) || 0),
    }));
  if (sections.length === 0) throw new Error("template_empty");
  return {
    template_title: String(t.template_title ?? "Phiếu nhận xét").slice(0, 200),
    language: t.language === "en" ? "en" : "vi",
    purpose: String(t.purpose ?? "").slice(0, 600),
    info_fields: (t.info_fields ?? []).filter((f) => f?.label).slice(0, 20).map((f) => ({ label: String(f.label).slice(0, 120), fill_from_document: !!f.fill_from_document })),
    sections,
    scale_total: Math.max(0, Number(t.scale_total) || 0),
    scoring_notes: String(t.scoring_notes ?? "").slice(0, 1500),
    ambiguities: (t.ambiguities ?? []).map(String).slice(0, 20),
  };
}

/** Khung mẫu có sẵn: mỗi tiêu chí của thang điểm mặc định là một mục nhận xét, cuối cùng là kết luận và kiến nghị. */
export function builtinTemplate(docType: string, lang: Lang = "vi"): Template {
  const en = lang === "en";
  const rubric = defaultRubric(docType, lang);
  const sections: Partial<TemplateSection>[] = rubric.map((c, i) => ({
    number: `${i + 1}.`, title: c.label, level: 1, kind: "narrative", guidance: c.description, max_points: 0,
  }));
  sections.push({
    number: `${rubric.length + 1}.`, title: en ? "Conclusion and recommendations" : "Kết luận và kiến nghị", level: 1, kind: "conclusion", max_points: 0,
    guidance: en ? "Overall conclusion consistent with the proposed score; state the required revisions." : "Kết luận chung, nhất quán với điểm đề xuất; nêu các chỉnh sửa bắt buộc.",
  });
  const typeLabel = labelsFor(lang).docType(docType);
  return normalizeTemplate({
    template_title: en ? `Review form: ${typeLabel.toLowerCase()}` : `Phiếu nhận xét ${typeLabel.toLowerCase()}`,
    language: lang,
    purpose: en ? "Review, critique and propose a score." : "Nhận xét, phản biện và đề xuất điểm.",
    info_fields: en ? [{ label: "Title of the work", fill_from_document: true }, { label: "Author", fill_from_document: true }] : [{ label: "Tên đề tài/công trình", fill_from_document: true }, { label: "Tác giả", fill_from_document: true }],
    sections, scale_total: 0, scoring_notes: "",
  });
}

/** Mẫu không quy định điểm thành phần thì chấm theo thang mặc định. */
export const usesDefaultRubric = (t: Template) => !t.sections.some((s) => s.max_points > 0);

/** Chia các mục thành các lô nhỏ; mỗi lô là một lần gọi AI (chạy tuần tự để tận dụng bộ nhớ đệm của văn bản). */
export function sectionBatches(t: Template, size = 4): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < t.sections.length; i += size) out.push(t.sections.slice(i, i + size).map((s) => s.id));
  return out;
}
