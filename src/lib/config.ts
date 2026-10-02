// Thông tin ứng dụng, tác giả và bản quyền. Sửa tại đây khi cần.
export const APP = {
  name: { vi: "Trợ lý học thuật", en: "AI Academic Agent" },
  version: "1.0",
  year: 2026,
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || (typeof location !== "undefined" ? location.origin : ""),
  author: {
    name: "Lương Việt Hoàng",
    org: "ISA Vietnam",
    // Các trường dưới đây là tùy chọn: điền thì chân trang tự hiển thị, để trống thì ẩn.
    role: { vi: "", en: "" },          // ví dụ: { vi: "Nghiên cứu sinh, Quản lý giáo dục", en: "Doctoral researcher, Educational Management" }
    orcid: "",                          // ví dụ: "0000-0002-1825-0097"
    website: "",                        // ví dụ: "https://isavn.edu.vn"
    edufind: "https://edufind.isavn.edu.vn/",
  },
};

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
