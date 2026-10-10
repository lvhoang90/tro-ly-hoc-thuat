// Lược đồ JSON (structured output) cho từng bước gọi AI.
type Schema = Record<string, unknown>;
const str = { type: "string" };
const strArr = { type: "array", items: str };
const obj = (properties: Record<string, unknown>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

const evidence = {
  type: "array",
  items: obj({
    quote: { type: "string", description: "Trích NGUYÊN VĂN từ tài liệu, tối đa khoảng 40 từ, không sửa chữ." },
    note: { type: "string", description: "Một câu nêu đoạn trích minh chứng cho điều gì." },
  }),
};

export const TEMPLATE_SCHEMA = obj({
  template_title: str,
  language: { type: "string", enum: ["vi", "en"] },
  purpose: { type: "string", description: "Mẫu dùng để làm gì (nhận xét đề cương, phản biện luận án, ...)." },
  info_fields: {
    type: "array",
    description: "Các trường thông tin hành chính ở đầu mẫu (đề tài, học viên, người nhận xét, ...).",
    items: obj({ label: str, fill_from_document: { type: "boolean", description: "true nếu thông tin có thể lấy từ chính công trình (tên đề tài, tác giả); false nếu là thông tin của người nhận xét/hội đồng." } }),
  },
  sections: {
    type: "array",
    items: obj({
      id: { type: "string", description: "s1, s2, ... theo thứ tự xuất hiện trong mẫu." },
      number: { type: "string", description: 'Số/ký hiệu mục đúng như trong mẫu (ví dụ "1.", "II.", "a)"); chuỗi rỗng nếu không có.' },
      title: { type: "string", description: "Tiêu đề mục NGUYÊN VĂN như trong mẫu." },
      level: { type: "integer", description: "1 = mục lớn, 2 = mục con, 3 = mục con của mục con." },
      kind: { type: "string", enum: ["narrative", "scored", "checklist", "conclusion"], description: "narrative: viết nhận xét; scored: có điểm; checklist: chọn đạt/không đạt hay có/không; conclusion: kết luận/đề nghị." },
      guidance: { type: "string", description: "Hướng dẫn/gợi ý/câu hỏi trong mẫu cho mục này (nguyên văn hoặc tóm lược sát); rỗng nếu không có." },
      max_points: { type: "number", description: "Điểm tối đa của mục theo mẫu; 0 nếu mẫu không quy định điểm cho mục này." },
    }),
  },
  scale_total: { type: "number", description: "Tổng điểm tối đa theo mẫu (ví dụ 10 hoặc 100); 0 nếu mẫu không có chấm điểm." },
  scoring_notes: { type: "string", description: "Quy định xếp loại, ngưỡng đạt, quy tắc chấm trong mẫu (nếu có); nếu không thì chuỗi rỗng." },
  ambiguities: strArr,
});

/** Lô các mục của khung mẫu. */
export const SECTIONS_SCHEMA = obj({
  sections: {
    type: "array",
    items: obj({
      section_id: str,
      content: { type: "string", description: "Nội dung nhận xét học thuật của mục, viết thành đoạn văn (ngăn đoạn bằng dòng trống)." },
      strengths: strArr,
      weaknesses: strArr,
      revisions: { type: "array", items: obj({ priority: { type: "string", enum: ["bat_buoc", "nen_lam", "goi_y"] }, action: str }) },
      evidence,
      points: { type: "number", description: "Điểm đề xuất cho mục (0 nếu mục không chấm điểm)." },
      point_rationale: { type: "string", description: "Cơ sở cho điểm; rỗng nếu mục không chấm điểm." },
      insufficient_basis: { type: "boolean", description: "true nếu văn bản được nộp không đủ cơ sở để đánh giá mục này." },
    }),
  },
});

/** Phần tổng hợp: hồ sơ, điểm theo thang, khuyết điểm, liêm chính, câu hỏi, hạn chế, kết luận. */
export function overallSchema({ withRubric }: { withRubric: boolean }) {
  const props: Record<string, unknown> = {
    document_profile: obj({
      title: { type: "string", description: 'Tên đề tài/tên bài như ghi trong tài liệu; "Không xác định" nếu không có.' },
      author: { type: "string", description: 'Tác giả nếu tài liệu nêu rõ; nếu không, "Không xác định".' },
      field: str,
      type_detected: str,
      completeness: { type: "string", description: "Nhận định ngắn về mức đầy đủ của phần được nộp (đủ các chương/phần hay thiếu)." },
    }),
    info_values: { type: "array", items: obj({ label: str, value: { type: "string", description: "Giá trị lấy từ tài liệu; để chuỗi rỗng nếu không có trong tài liệu. Tuyệt đối không tự đặt tên người nhận xét." } }) },
    fatal_defects: {
      type: "array",
      description: "Chỉ liệt kê khuyết điểm đủ nghiêm trọng để, một mình nó, làm công trình không thể được thông qua ở hình thức hiện tại.",
      items: obj({ severity: { type: "string", enum: ["fatal", "serious"] }, description: str, evidence }),
    },
    integrity_notes: {
      type: "array",
      description: "Dấu hiệu cần kiểm tra về liêm chính (không kết luận vi phạm).",
      items: obj({ concern: str, evidence, suggested_check: str }),
    },
    overall: obj({
      summary: { type: "string", description: "Nhận xét tổng quát 1–3 đoạn." },
      main_strengths: strArr,
      main_weaknesses: strArr,
      conclusion_text: { type: "string", description: "Kết luận và kiến nghị, nhất quán với điểm đề xuất." },
      proposed_decision: { type: "string", enum: ["reject", "major_revision", "minor_revision", "accept_with_conditions", "accept"] },
    }),
    questions_for_author: { type: "array", description: "Câu hỏi phản biện/chất vấn tác giả.", items: str },
    limitations: { type: "array", description: "Những điều hệ thống không thể đánh giá hoặc cần người phản biện kiểm tra thêm.", items: str },
  };
  if (withRubric) props.rubric_scores = { type: "array", items: obj({ criterion_id: str, points: { type: "number" }, rationale: str, evidence }) };
  return obj(props);
}
export const OVERALL_ID = "overall";
