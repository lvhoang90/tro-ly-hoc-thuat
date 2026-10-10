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
const C = (id: string, label: string, max: number, description: string): Criterion => ({ id, label, max, description });

/** Thang điểm mặc định (tổng 100) dùng khi mẫu của trường/viện không quy định điểm thành phần. */
export function defaultRubric(docType: string): Criterion[] {
  switch (docType) {
    case "proposal":
      return [
        C("c1", "Tính cấp thiết và tổng quan nghiên cứu", 20, "Vấn đề nghiên cứu có căn cứ; tổng quan nêu được những gì đã biết và khoảng trống tri thức."),
        C("c2", "Mục tiêu, câu hỏi và giả thuyết nghiên cứu", 15, "Rõ ràng, nhất quán, kiểm chứng được, tương xứng với vấn đề."),
        C("c3", "Cơ sở lý thuyết và phương pháp nghiên cứu", 25, "Khung lý thuyết, thiết kế, mẫu, công cụ, phương pháp phân tích phù hợp với câu hỏi nghiên cứu."),
        C("c4", "Tính mới và ý nghĩa khoa học, thực tiễn", 15, "Đóng góp dự kiến có căn cứ, không phóng đại."),
        C("c5", "Tính khả thi và đạo đức nghiên cứu", 15, "Thời gian, nguồn lực, tiếp cận dữ liệu, rủi ro, chuẩn mực đạo đức."),
        C("c6", "Cấu trúc, văn phong và tài liệu tham khảo", 10, "Bố cục, lập luận, nhất quán trích dẫn, quy cách trình bày."),
      ];
    case "article":
      return [
        C("c1", "Tính mới và đóng góp khoa học", 20, "Đóng góp so với tài liệu hiện có được nêu và chứng minh."),
        C("c2", "Tổng quan và khung lý thuyết", 15, "Bao quát, chọn lọc, định vị đúng nghiên cứu."),
        C("c3", "Phương pháp nghiên cứu", 20, "Thiết kế, mẫu, đo lường, quy trình có thể kiểm tra và lặp lại."),
        C("c4", "Kết quả và thảo luận", 20, "Kết quả được trình bày trung thực, phân tích đúng, diễn giải có đối chiếu tài liệu."),
        C("c5", "Kết luận và tính nhất quán của lập luận", 10, "Kết luận được bằng chứng ủng hộ; nêu hạn chế."),
        C("c6", "Cấu trúc, văn phong và tài liệu tham khảo", 10, "Bố cục, ngôn ngữ, trích dẫn, quy cách."),
        C("c7", "Đạo đức và minh bạch học thuật", 5, "Chấp thuận đạo đức, dữ liệu, xung đột lợi ích, đóng góp tác giả, khai báo công cụ."),
      ];
    case "dissertation":
      return [
        C("c1", "Tính cấp thiết và tổng quan nghiên cứu", 10, "Vấn đề, khoảng trống nghiên cứu, tổng quan có hệ thống."),
        C("c2", "Mục tiêu, câu hỏi, giả thuyết và khung lý thuyết", 15, "Rõ ràng, nhất quán, có nền tảng lý thuyết vững."),
        C("c3", "Phương pháp nghiên cứu", 20, "Thiết kế, mẫu, công cụ, độ tin cậy/giá trị, phương pháp phân tích."),
        C("c4", "Kết quả nghiên cứu và thảo luận", 20, "Dữ liệu, phân tích, diễn giải có căn cứ, đối chiếu với tài liệu."),
        C("c5", "Đóng góp mới về khoa học và thực tiễn", 20, "Đóng góp mới được chứng minh, có phân biệt với nghiên cứu trước."),
        C("c6", "Cấu trúc, lập luận và văn phong", 5, "Bố cục chặt chẽ, lập luận mạch lạc, văn phong học thuật."),
        C("c7", "Tài liệu tham khảo và liêm chính học thuật", 10, "Trích dẫn nhất quán, nguồn tin cậy, không có dấu hiệu bất thường về liêm chính."),
      ];
    default:
      return [
        C("c1", "Tính cấp thiết và tổng quan nghiên cứu", 15, "Vấn đề, khoảng trống nghiên cứu, tổng quan."),
        C("c2", "Mục tiêu, câu hỏi, giả thuyết và khung lý thuyết", 15, "Rõ ràng, nhất quán, có nền tảng lý thuyết."),
        C("c3", "Phương pháp nghiên cứu", 20, "Thiết kế, mẫu, công cụ, phương pháp phân tích."),
        C("c4", "Kết quả nghiên cứu và thảo luận", 20, "Dữ liệu, phân tích, diễn giải có căn cứ."),
        C("c5", "Đóng góp mới về khoa học và thực tiễn", 15, "Đóng góp được chứng minh, không phóng đại."),
        C("c6", "Cấu trúc, lập luận và văn phong", 5, "Bố cục, lập luận, văn phong học thuật."),
        C("c7", "Tài liệu tham khảo và liêm chính học thuật", 10, "Trích dẫn nhất quán, nguồn tin cậy, liêm chính."),
      ];
  }
}

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
