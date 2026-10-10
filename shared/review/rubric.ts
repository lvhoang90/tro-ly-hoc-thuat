// Thang điểm, ngưỡng khuyến nghị và cách tính điểm của tính năng Phản biện (chuyển từ ứng dụng "Trợ lý phản biện học thuật").
// Tổng điểm luôn do mã tính, không lấy số tổng do mô hình tự khai.
export const DOC_TYPES = {
  proposal: "Đề cương nghiên cứu",
  article: "Bài báo khoa học",
  thesis: "Luận văn thạc sĩ",
  dissertation: "Luận án tiến sĩ",
  other: "Công trình khoa học khác",
} as const;
export type DocType = keyof typeof DOC_TYPES;

export const ROLES = {
  reviewer: "Người phản biện",
  supervisor: "Người hướng dẫn",
  council: "Thành viên hội đồng",
  other: "Vai trò khác",
} as const;
export type Role = keyof typeof ROLES;

export interface Criterion { id: string; label: string; max: number; description: string }
export type Lang = "vi" | "en";

/** Thang điểm mặc định (tổng 100) dùng khi mẫu của trường/viện không quy định điểm thành phần. Mã tiêu chí giống nhau ở hai ngôn ngữ. */
const RUBRICS: Record<string, [string, number, string, string, string, string][]> = {
 "proposal": [
  [
   "c1",
   20,
   "Tính cấp thiết và tổng quan nghiên cứu",
   "Vấn đề nghiên cứu có căn cứ; tổng quan nêu được những gì đã biết và khoảng trống tri thức.",
   "Rationale and literature review",
   "The research problem is well grounded; the review shows what is known and the knowledge gap."
  ],
  [
   "c2",
   15,
   "Mục tiêu, câu hỏi và giả thuyết nghiên cứu",
   "Rõ ràng, nhất quán, kiểm chứng được, tương xứng với vấn đề.",
   "Aims, questions and hypotheses",
   "Clear, consistent, testable and proportionate to the problem."
  ],
  [
   "c3",
   25,
   "Cơ sở lý thuyết và phương pháp nghiên cứu",
   "Khung lý thuyết, thiết kế, mẫu, công cụ, phương pháp phân tích phù hợp với câu hỏi nghiên cứu.",
   "Theory and research method",
   "Framework, design, sample, instruments and analysis fit the research questions."
  ],
  [
   "c4",
   15,
   "Tính mới và ý nghĩa khoa học, thực tiễn",
   "Đóng góp dự kiến có căn cứ, không phóng đại.",
   "Novelty and scientific and practical significance",
   "Expected contribution is justified, not overstated."
  ],
  [
   "c5",
   15,
   "Tính khả thi và đạo đức nghiên cứu",
   "Thời gian, nguồn lực, tiếp cận dữ liệu, rủi ro, chuẩn mực đạo đức.",
   "Feasibility and research ethics",
   "Time, resources, data access, risks and ethical standards."
  ],
  [
   "c6",
   10,
   "Cấu trúc, văn phong và tài liệu tham khảo",
   "Bố cục, lập luận, nhất quán trích dẫn, quy cách trình bày.",
   "Structure, style and references",
   "Organisation, argument, consistent citation, formatting."
  ]
 ],
 "article": [
  [
   "c1",
   20,
   "Tính mới và đóng góp khoa học",
   "Đóng góp so với tài liệu hiện có được nêu và chứng minh.",
   "Novelty and scientific contribution",
   "The contribution over existing literature is stated and demonstrated."
  ],
  [
   "c2",
   15,
   "Tổng quan và khung lý thuyết",
   "Bao quát, chọn lọc, định vị đúng nghiên cứu.",
   "Literature review and framework",
   "Comprehensive, selective, and positions the study correctly."
  ],
  [
   "c3",
   20,
   "Phương pháp nghiên cứu",
   "Thiết kế, mẫu, đo lường, quy trình có thể kiểm tra và lặp lại.",
   "Research method",
   "Design, sample, measurement and procedure can be checked and repeated."
  ],
  [
   "c4",
   20,
   "Kết quả và thảo luận",
   "Kết quả được trình bày trung thực, phân tích đúng, diễn giải có đối chiếu tài liệu.",
   "Results and discussion",
   "Results are reported honestly, analysed correctly and discussed against the literature."
  ],
  [
   "c5",
   10,
   "Kết luận và tính nhất quán của lập luận",
   "Kết luận được bằng chứng ủng hộ; nêu hạn chế.",
   "Conclusions and consistency of argument",
   "Conclusions are supported by the evidence; limitations are stated."
  ],
  [
   "c6",
   10,
   "Cấu trúc, văn phong và tài liệu tham khảo",
   "Bố cục, ngôn ngữ, trích dẫn, quy cách.",
   "Structure, style and references",
   "Organisation, language, citation, formatting."
  ],
  [
   "c7",
   5,
   "Đạo đức và minh bạch học thuật",
   "Chấp thuận đạo đức, dữ liệu, xung đột lợi ích, đóng góp tác giả, khai báo công cụ.",
   "Ethics and academic transparency",
   "Ethical approval, data, conflicts of interest, author contributions, tool disclosure."
  ]
 ],
 "dissertation": [
  [
   "c1",
   10,
   "Tính cấp thiết và tổng quan nghiên cứu",
   "Vấn đề, khoảng trống nghiên cứu, tổng quan có hệ thống.",
   "Rationale and literature review",
   "Problem, research gap, systematic review."
  ],
  [
   "c2",
   15,
   "Mục tiêu, câu hỏi, giả thuyết và khung lý thuyết",
   "Rõ ràng, nhất quán, có nền tảng lý thuyết vững.",
   "Aims, questions, hypotheses and framework",
   "Clear, consistent, with a sound theoretical basis."
  ],
  [
   "c3",
   20,
   "Phương pháp nghiên cứu",
   "Thiết kế, mẫu, công cụ, độ tin cậy/giá trị, phương pháp phân tích.",
   "Research method",
   "Design, sample, instruments, reliability and validity, analysis."
  ],
  [
   "c4",
   20,
   "Kết quả nghiên cứu và thảo luận",
   "Dữ liệu, phân tích, diễn giải có căn cứ, đối chiếu với tài liệu.",
   "Results and discussion",
   "Data, analysis, well-founded interpretation, comparison with the literature."
  ],
  [
   "c5",
   20,
   "Đóng góp mới về khoa học và thực tiễn",
   "Đóng góp mới được chứng minh, có phân biệt với nghiên cứu trước.",
   "New scientific and practical contributions",
   "New contributions are demonstrated and distinguished from earlier work."
  ],
  [
   "c6",
   5,
   "Cấu trúc, lập luận và văn phong",
   "Bố cục chặt chẽ, lập luận mạch lạc, văn phong học thuật.",
   "Structure, argument and style",
   "Tight structure, coherent argument, academic style."
  ],
  [
   "c7",
   10,
   "Tài liệu tham khảo và liêm chính học thuật",
   "Trích dẫn nhất quán, nguồn tin cậy, không có dấu hiệu bất thường về liêm chính.",
   "References and academic integrity",
   "Consistent citation, reliable sources, no unusual integrity signs."
  ]
 ],
 "default": [
  [
   "c1",
   15,
   "Tính cấp thiết và tổng quan nghiên cứu",
   "Vấn đề, khoảng trống nghiên cứu, tổng quan.",
   "Rationale and literature review",
   "Problem, research gap, review."
  ],
  [
   "c2",
   15,
   "Mục tiêu, câu hỏi, giả thuyết và khung lý thuyết",
   "Rõ ràng, nhất quán, có nền tảng lý thuyết.",
   "Aims, questions, hypotheses and framework",
   "Clear, consistent, with a theoretical basis."
  ],
  [
   "c3",
   20,
   "Phương pháp nghiên cứu",
   "Thiết kế, mẫu, công cụ, phương pháp phân tích.",
   "Research method",
   "Design, sample, instruments, analysis."
  ],
  [
   "c4",
   20,
   "Kết quả nghiên cứu và thảo luận",
   "Dữ liệu, phân tích, diễn giải có căn cứ.",
   "Results and discussion",
   "Data, analysis, well-founded interpretation."
  ],
  [
   "c5",
   15,
   "Đóng góp mới về khoa học và thực tiễn",
   "Đóng góp được chứng minh, không phóng đại.",
   "New contributions",
   "Contributions are demonstrated and not overstated."
  ],
  [
   "c6",
   5,
   "Cấu trúc, lập luận và văn phong",
   "Bố cục, lập luận, văn phong học thuật.",
   "Structure, argument and style",
   "Organisation, argument, academic style."
  ],
  [
   "c7",
   10,
   "Tài liệu tham khảo và liêm chính học thuật",
   "Trích dẫn nhất quán, nguồn tin cậy, liêm chính.",
   "References and academic integrity",
   "Consistent citation, reliable sources, integrity."
  ]
 ]
};

export function defaultRubric(docType: string, lang: Lang = "vi"): Criterion[] {
  const rows = RUBRICS[docType] ?? RUBRICS.default;
  return rows.map(([id, max, vl, vd, el, ed]) => ({ id, max, label: lang === "en" ? el : vl, description: lang === "en" ? ed : vd }));
}

export const DOC_TYPES_EN: Record<DocType, string> = { proposal: "Research proposal", article: "Scientific article", thesis: "Master's thesis", dissertation: "Doctoral dissertation", other: "Other scientific work" };
export const ROLES_EN: Record<Role, string> = { reviewer: "Reviewer", supervisor: "Supervisor", council: "Committee member", other: "Other role" };

export type DecisionKey = "reject" | "major_revision" | "minor_revision" | "accept_with_conditions" | "accept";
export interface Decision { key: DecisionKey | "unscored"; label: string; short: string; severity: string; advice: string; floorApplied: boolean; belowPass: boolean }
type DecisionText = Omit<Decision, "key" | "floorApplied" | "belowPass">;

export const DECISIONS: Record<DecisionKey, DecisionText> = {
  reject: {
    label: "Không thông qua — đề nghị trả lại, viết lại toàn bộ", short: "Từ chối", severity: "danger",
    advice: "Công trình chưa đáp ứng yêu cầu tối thiểu về vấn đề nghiên cứu, thiết kế hoặc lập luận. Đề nghị người hướng dẫn / người phản biện không chấp thuận ở hình thức hiện tại và yêu cầu tác giả xây dựng lại toàn bộ trước khi nộp lại.",
  },
  major_revision: {
    label: "Chưa thông qua — yêu cầu chỉnh sửa lớn và phản biện lại", short: "Chỉnh sửa lớn", severity: "danger",
    advice: "Công trình có khiếm khuyết đáng kể ở những nội dung cốt lõi (thiết kế nghiên cứu, dữ liệu, lập luận hoặc đóng góp). Đề nghị yêu cầu tác giả chỉnh sửa lớn, giải trình từng điểm và nộp lại để đánh giá lại trước khi xem xét thông qua.",
  },
  minor_revision: {
    label: "Chưa thông qua — cần chỉnh sửa, bổ sung trước khi xem xét lại", short: "Chỉnh sửa trước khi thông qua", severity: "warning",
    advice: "Điểm đề xuất thấp hơn ngưỡng 60 nhưng khiếm khuyết có thể khắc phục mà không phải thay đổi hướng nghiên cứu. Đề nghị tác giả chỉnh sửa theo các yêu cầu bắt buộc và nộp lại để xác nhận trước khi thông qua.",
  },
  accept_with_conditions: {
    label: "Thông qua có điều kiện — chỉnh sửa theo góp ý", short: "Thông qua có điều kiện", severity: "caution",
    advice: "Công trình đạt yêu cầu tối thiểu nhưng còn hạn chế cần khắc phục. Đề nghị thông qua với điều kiện tác giả hoàn thành các chỉnh sửa bắt buộc và được người hướng dẫn xác nhận.",
  },
  accept: {
    label: "Thông qua — chỉnh sửa nhỏ (nếu có)", short: "Thông qua", severity: "ok",
    advice: "Công trình đáp ứng yêu cầu; chỉ cần hoàn thiện các điểm nhỏ nêu trong nhận xét.",
  },
};

type DecisionText2 = DecisionText;
export const DECISIONS_EN: Record<DecisionKey, DecisionText2> = {
  reject: { label: "Reject: return and rewrite entirely", short: "Reject", severity: "danger", advice: "The work does not meet the minimum requirements for research problem, design or argument. It is recommended that the supervisor or reviewer not approve it in its current form and ask the author to rebuild it entirely before resubmitting." },
  major_revision: { label: "Not approved: major revision and re-review", short: "Major revision", severity: "danger", advice: "The work has substantial flaws in core elements (research design, data, argument or contribution). The author should revise extensively, respond point by point and resubmit for re-assessment before approval is considered." },
  minor_revision: { label: "Not yet approved: revise and supplement before reconsideration", short: "Revise before approval", severity: "warning", advice: "The proposed score is below the 60 threshold but the flaws can be fixed without changing the research direction. The author should make the required revisions and resubmit for confirmation before approval." },
  accept_with_conditions: { label: "Accept with conditions: revise as advised", short: "Accept with conditions", severity: "caution", advice: "The work meets the minimum requirements but still has limitations to address. Approve on condition that the author completes the required revisions and the supervisor confirms them." },
  accept: { label: "Accept: minor changes (if any)", short: "Accept", severity: "ok", advice: "The work meets the requirements; only the minor points in the review need finishing." },
};
export const UNSCORED_EN = { short: "No score", label: "Not scored: the reviewer must score", advice: "The system did not receive enough component scores for this work. Run it again or score it in the score table; the recommendation will update when scores are available." };

/** Nhãn hiển thị theo ngôn ngữ giao diện (kết quả lưu chỉ giữ khóa, nhãn được tra lại khi hiển thị hoặc xuất Word). */
export function labelsFor(lang: Lang) {
  const en = lang === "en";
  return {
    docType: (k: string) => (en ? DOC_TYPES_EN : DOC_TYPES)[(k in DOC_TYPES ? k : "other") as DocType],
    role: (k: string) => (en ? ROLES_EN : ROLES)[(k in ROLES ? k : "other") as Role],
    decision: (key: string): { label: string; short: string; advice: string } => {
      if (key === "unscored") return en ? UNSCORED_EN : { short: UNSCORED.short, label: UNSCORED.label, advice: UNSCORED.advice };
      const k = (key in DECISIONS ? key : "major_revision") as DecisionKey;
      return (en ? DECISIONS_EN : DECISIONS)[k];
    },
  };
}

export const UNSCORED: Decision = {
  key: "unscored", short: "Chưa có điểm", label: "Chưa chấm được điểm — người phản biện cần tự chấm", severity: "caution",
  advice: "Hệ thống không nhận được đủ điểm thành phần cho công trình này. Vui lòng chạy lại hoặc tự chấm điểm trong bảng điểm; khuyến nghị sẽ cập nhật khi có điểm.",
  floorApplied: false, belowPass: false,
};

const ORDER: DecisionKey[] = ["reject", "major_revision", "minor_revision", "accept_with_conditions", "accept"];
/** Ngưỡng điểm (thang 100) để phân loại khuyến nghị. */
export const THRESHOLDS = { reject: 40, major: 55, pass: 60, good: 75 };

export function decisionFromScore(score: number, t = THRESHOLDS): DecisionKey {
  if (score < t.reject) return "reject";
  if (score < t.major) return "major_revision";
  if (score < t.pass) return "minor_revision";
  if (score < t.good) return "accept_with_conditions";
  return "accept";
}

/** Kết quả cuối theo điểm; có khuyết điểm "rất nghiêm trọng" thì không được xếp tốt hơn "chỉnh sửa lớn". */
export function decide(score: number, fatalDefects: { severity: string }[] = []): Decision {
  let key = decisionFromScore(score);
  let floorApplied = false;
  if (fatalDefects.some((d) => d.severity === "fatal") && ORDER.indexOf(key) > ORDER.indexOf("major_revision")) {
    key = "major_revision";
    floorApplied = true;
  }
  return { key, ...DECISIONS[key], floorApplied, belowPass: score < THRESHOLDS.pass || key === "major_revision" || key === "reject" };
}

export const round1 = (x: number) => Math.round(x * 10) / 10;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : 0));

export interface ScoreItem { id?: string; label?: string; max: number; points: number; rationale?: string; evidence?: Evidence[] }
export interface Evidence { quote: string; note?: string; paragraph?: number; page?: number }

/** Tính điểm tổng thang 100 từ điểm thành phần do mô hình đề xuất (kẹp trong 0..max). */
export function computeScore<T extends ScoreItem>(items: T[]) {
  const rows = items.map((i) => {
    const max = Number(i.max) || 0;
    return { ...i, max, points: round1(clamp(Number(i.points), 0, max)) };
  });
  const sumMax = rows.reduce((s, r) => s + r.max, 0);
  const sum = rows.reduce((s, r) => s + r.points, 0);
  return { rows, sum: round1(sum), sumMax, score100: sumMax > 0 ? round1((sum / sumMax) * 100) : 0 };
}
