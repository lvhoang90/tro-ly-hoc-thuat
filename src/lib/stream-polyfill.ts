/** Safari/WebKit chưa hỗ trợ `for await` trên ReadableStream, mà pdf.js dùng khi lấy văn bản trang (lỗi "undefined is not a function"). Bổ sung khi thiếu. */
export function polyfillStreamAsyncIterator(target: { ReadableStream?: unknown } = globalThis): void {
  const proto = (target.ReadableStream as { prototype?: object } | undefined)?.prototype as Record<PropertyKey, unknown> | undefined;
  if (!proto || proto[Symbol.asyncIterator]) return;
  const iter = async function* (this: ReadableStream) {
    const reader = this.getReader();
    try { for (;;) { const { done, value } = await reader.read(); if (done) return; yield value; } } finally { reader.releaseLock(); }
  };
  proto[Symbol.asyncIterator] = iter;
  if (!proto.values) proto.values = iter;
}
