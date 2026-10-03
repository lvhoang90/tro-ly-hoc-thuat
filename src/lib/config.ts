// Thông tin ứng dụng, tác giả và bản quyền. Sửa tại đây khi cần.
export const APP = {
  name: { vi: "Trợ lý học thuật", en: "AI Academic Agent" },
  version: "1.0",
  /** Phiên bản phát hành (Semantic Versioning), khớp package.json và CHANGELOG.md; tests/release.test.ts kiểm tra. */
  release: { version: "1.1.0", date: "2026-10-03", notes: { vi: "/ghi-chu-phat-hanh", en: "/en/release-notes" } },
  year: 2026,
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || (typeof location !== "undefined" ? location.origin : ""),
  author: {
    name: "Lương Việt Hoàng",
    org: "ISA Vietnam",
    // Các trường dưới đây là tùy chọn: điền thì chân trang tự hiển thị, để trống thì ẩn.
    role: { vi: "Phó Viện trưởng, Viện Khoa học Giáo dục & Kinh tế Đông Nam Á", en: "Deputy Director, Institute of Education Sciences and Economics of Southeast Asia" },
    photo: "/author.jpg",
    // Nội dung cô đọng từ phần "Tác giả" của EduFind (https://edufind.isavn.edu.vn/).
    facts: [
      { k: { vi: "Phụ trách", en: "Responsibility" }, v: { vi: "Chuyển đổi số tại các trường phổ thông (tiểu học, THCS, THPT).", en: "Digital transformation in primary, lower- and upper-secondary schools." } },
      { k: { vi: "Dự án", en: "Projects" }, v: { vi: "Nghiên cứu và triển khai giáo dục AI và Robotics theo mô hình xã hội hóa tại TP.HCM và Đồng bằng sông Cửu Long.", en: "Research and delivery of AI and Robotics education under the socialization model in Ho Chi Minh City and the Mekong Delta." } },
      { k: { vi: "Học vấn", en: "Education" }, v: { vi: "Thạc sĩ (MSc) Marketing và Thương mại, Université Paris 1 Panthéon-Sorbonne (Pháp); nghiên cứu sinh ngành Quản lý giáo dục.", en: "MSc in Marketing and Commerce, Université Paris 1 Panthéon-Sorbonne (France); doctoral candidate in Educational Management." } },
      { k: { vi: "Hướng nghiên cứu", en: "Research" }, v: { vi: "Cách các hệ thống trường học huy động tài chính, quản trị và điều hành việc dạy học AI và Robotics.", en: "How school systems finance, govern and manage the teaching of AI and Robotics." } },
    ],
    orcid: "0009-0000-5248-6186",
    website: "https://isavietnam.app/",
    edufind: "https://edufind.isavn.edu.vn/",
    vanthu: "https://trolyvanthu.isavn.edu.vn/",
    // Hệ sinh thái ISA: ba bước nối tiếp (chọn tạp chí, đọc và trích dẫn, chuẩn hóa thể thức). Đồng bộ với trolyvanthu.isavn.edu.vn/he-sinh-thai.
    ecoEdufind: "https://edufind.isavn.edu.vn/giao-duc/",
  },
};

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Thêm tham số theo dõi nguồn truy cập cho liên kết chéo giữa các ứng dụng ISA. */
export const withUtm = (url: string, campaign = "footer") => { try { const u = new URL(url); u.searchParams.set("utm_source", "tro-ly-hoc-thuat"); u.searchParams.set("utm_medium", "ecosystem"); u.searchParams.set("utm_campaign", campaign); return u.toString(); } catch { return url; } };
