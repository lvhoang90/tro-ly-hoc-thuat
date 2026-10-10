// Kiểu dữ liệu dùng chung giữa trình duyệt (src) và máy chủ (api).

export type Lang = "vi" | "en";
export type Priority = "high" | "medium" | "low";

export type SourceType = "article" | "book" | "chapter" | "conference" | "thesis" | "report" | "web";

export interface Author { family: string; given: string }

/** Siêu dữ liệu nguồn tài liệu (do AI trích xuất, người dùng có thể sửa trước khi tạo trích dẫn). */
export interface SourceMeta {
  type: SourceType;
  title: string;
  authors: Author[];
  year: string;
  container: string;      // tên tạp chí / sách / hội nghị
  publisher: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  lang?: Lang;            // ngôn ngữ của tài liệu
  titleEn?: string;       // bản dịch tiếng Anh của nhan đề (tài liệu tiếng Việt)
}

/** Nội dung song ngữ: phân tích sinh một lần, giao diện đổi ngôn ngữ thì đổi theo ngay, không gọi AI lần nữa. */
export interface Bi<T = string> { vi: T; en: T }

export interface Passage {
  id: string;
  quote: string;          // nguyên văn, đã đối chiếu với văn bản gốc
  page: string;           // số trang (PDF) hoặc rỗng
  priority: Priority;
  rank: number;           // 1 = nên trích trước
  reason: Bi;
  use: "definition" | "evidence" | "method" | "finding" | "theory" | "context";
}

export interface ScoreBreakdown {
  topic: number;          // /40
  concept: number;        // /20
  method: number;         // /15
  evidence: number;       // /15
  currency: number;       // /10
}

export interface WorkRec {
  title: string; authors: string; year: number | null; venue: string; doi: string; url: string;
  citedBy: number; openAccess: boolean; issn: string[];
}

export interface JournalRec {
  title: string; issn: string[]; publisher: string; quartile: string; sjr: number | null; openAccess: boolean;
  domestic: boolean; maxScore?: number; why: string;
  bkhcn?: number;         // số thứ tự trong Quyết định 2244/QĐ-BKHCN (2026), nếu có
  discipline: Bi;         // lĩnh vực EduFind chứa tạp chí
  url: string;            // trang lĩnh vực trên EduFind
}

export interface EdufindLink { slug: string; name: Bi; url: string }

export interface Recommendations {
  advice: Bi;
  queries: string[];
  keywords: string[];
  works: WorkRec[];
  journals: JournalRec[];
  disciplines: EdufindLink[];   // lĩnh vực EduFind phù hợp nhất với nghiên cứu của người dùng
  edufind: { url: string };     // cổng chung https://edufind.isavn.edu.vn/
  /** Hạng Cơ bản: chỉ cho biết số gợi ý, chi tiết mở khi xác thực (works/journals để trống). */
  locked?: { works: number; journals: number };
}

export interface AnalysisResult {
  language: "en" | "vi";
  score: number;
  breakdown: ScoreBreakdown;
  verdict: Bi;
  summary: Bi;
  strengths: Bi<string[]>;
  gaps: Bi<string[]>;
  meta: SourceMeta;
  passages: Passage[];          // rỗng nếu score < 60
  droppedPassages: number;      // số trích đoạn bị loại vì không khớp văn bản gốc
  recommendations: Recommendations | null; // chỉ có khi score < 60
  quota: Quota | null;
  truncated: boolean;
}

export interface Quota {
  role: "user" | "admin";
  status: "active" | "suspended";
  unlimited: boolean;
  approved: boolean;       // đã được quản trị viên xác nhận (hạn mức tệp cao hơn)
  max_file_mb: number;     // dung lượng tệp tối đa theo hạng người dùng
  free_limit: number;
  used_today: number;
  free_left: number;
  bonus: number;
  lifetime_used: number;
  tier: "basic" | "verified" | "admin";
  period: "day" | "week"; // chu kỳ tính free_limit/used_today/free_left
  next_reset: string;     // ngày (giờ Việt Nam) hạn mức đặt lại
  gated: boolean;         // hạng Cơ bản đang bị giới hạn lịch sử và gợi ý chi tiết
  tier_start: string;     // ngày bắt đầu áp dụng hạng
  basic_weekly: number;   // số lượt mỗi tuần của hạng Cơ bản
}

export type ApiErrorCode =
  | "unauthorized" | "email_unverified" | "suspended" | "quota_exhausted"
  | "not_verified" | "review_locked" | "review_token" | "review_limit" | "truncated"
  | "unsupported_language" | "no_text" | "too_long" | "bad_request" | "ai_failed" | "ai_refused" | "server_misconfigured" | "server_error";

export interface ApiError { error: ApiErrorCode; message?: string; quota?: Quota | null }

export const PASS_SCORE = 60;
/** Dung lượng tệp tuyệt đối tối đa (mức của người dùng đã xác nhận); mức cụ thể do quản trị viên đặt (Quota.max_file_mb). */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DEFAULT_FILE_MB = { basic: 5, approved: 15 } as const;
/** Giới hạn độ dài văn bản gửi AI theo hạng: máy chủ không thấy kích thước tệp nên giới hạn theo văn bản đã trích. */
export const MAX_TEXT_CHARS = 400_000;
export const MAX_TEXT_CHARS_BASIC = 150_000;
export const MAX_ABSTRACT_CHARS = 20_000;
export const MIN_ABSTRACT_WORDS = 40;
