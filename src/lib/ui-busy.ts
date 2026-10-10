// Tạm dừng các hiệu ứng trang trí (nền động, robot 3D) khi người dùng đang thao tác với ô nhập hoặc danh sách chọn,
// để hộp chọn và ô gõ luôn mượt (hộp chọn gốc của trình duyệt giật khi trang đang vẽ lại liên tục ở máy yếu).
let busy = false;
let timer = 0;
const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(SELECT|TEXTAREA|INPUT)$/.test(t.tagName);

if (typeof window !== "undefined") {
  addEventListener("focusin", (e) => { if (isField(e.target)) { busy = true; clearTimeout(timer); } });
  addEventListener("focusout", (e) => { if (isField(e.target)) { clearTimeout(timer); timer = window.setTimeout(() => { busy = false; }, 400); } });
  // Bấm vào hộp chọn là bắt đầu thao tác ngay, trước cả khi nó nhận tiêu điểm.
  addEventListener("pointerdown", (e) => { if (isField(e.target)) { busy = true; clearTimeout(timer); } }, true);
}

export const isUiBusy = () => busy;
