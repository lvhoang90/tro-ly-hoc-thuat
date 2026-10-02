import { test } from "node:test";
import assert from "node:assert/strict";
import { polyfillStreamAsyncIterator } from "../src/lib/stream-polyfill.ts";

const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;

test("bổ sung asyncIterator cho ReadableStream khi trình duyệt thiếu (Safari) và đọc đủ dữ liệu", async () => {
  const original = proto[Symbol.asyncIterator], values = proto.values;
  try {
    delete proto[Symbol.asyncIterator]; delete proto.values;
    assert.equal(proto[Symbol.asyncIterator], undefined);
    polyfillStreamAsyncIterator();
    const rs = new ReadableStream<number>({ start(c) { c.enqueue(1); c.enqueue(2); c.enqueue(3); c.close(); } });
    const got: number[] = [];
    for await (const v of rs as unknown as AsyncIterable<number>) got.push(v);
    assert.deepEqual(got, [1, 2, 3]);
  } finally { proto[Symbol.asyncIterator] = original; proto.values = values; }
});

test("không ghi đè khi trình duyệt đã hỗ trợ", () => {
  const before = proto[Symbol.asyncIterator];
  polyfillStreamAsyncIterator();
  assert.equal(proto[Symbol.asyncIterator], before);
});
