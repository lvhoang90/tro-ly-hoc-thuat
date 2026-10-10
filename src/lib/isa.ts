// Đo hành trình trong hệ sinh thái ISA: gửi sự kiện cho bộ theo dõi chung (isavn.edu.vn/embed.js → window.isaTrack).
// Không cookie, không gửi nội dung tài liệu hay thông tin cá nhân; chỉ tên sự kiện ngắn và nhãn như "vi"/"pass". Chưa tải được thì bỏ qua.
export function track(name: string, label = ""): void {
  try { (window as unknown as { isaTrack?: (n: string, l?: string) => void }).isaTrack?.(name, label); } catch { /* không bao giờ làm hỏng trang */ }
}
