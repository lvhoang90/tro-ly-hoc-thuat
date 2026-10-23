// Giữ kết nối khi một bước gọi AI kéo dài vài phút: gửi ngay một khoảng trắng rồi cứ vài giây một khoảng trắng nữa, cuối cùng mới gửi JSON.
// Không có byte nào trong nhiều phút thì mạng di động (và một số trình duyệt) tự ngắt kết nối, trình duyệt báo "Không kết nối được máy chủ"
// trong khi máy chủ vẫn chạy tiếp và vẫn tính tiền. Mã trạng thái HTTP đã gửi đi là 200 nên mã thật được ghi vào thân (`status`),
// trình duyệt đọc lại ở `call()` (src/lib/api.ts). Chỉ dùng khi trình duyệt xin bằng tiêu đề `x-ami-keepalive: 1`.
export function withKeepalive(work: () => Promise<Response>, everyMs = 8000): Response {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      const put = (s: string) => { if (!closed) { try { c.enqueue(enc.encode(s)); } catch { closed = true; } } };
      put(" ");
      timer = setInterval(() => put(" "), everyMs);
      const done = () => { clearInterval(timer); if (!closed) { closed = true; try { c.close(); } catch { /* đã đóng */ } } };
      work().then(async (r) => {
        let text = await r.text();
        if (!r.ok) {
          try { text = JSON.stringify({ ...JSON.parse(text), status: r.status }); }
          catch { text = JSON.stringify({ error: "server_error", message: String(r.status), status: r.status }); }
        }
        put(text);
      }, (e: unknown) => put(JSON.stringify({ error: "server_error", message: String((e as Error)?.message ?? e).slice(0, 200), status: 500 }))).finally(done);
    },
    cancel() { closed = true; clearInterval(timer); },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
