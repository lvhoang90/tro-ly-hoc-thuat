import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReadError, errorDetail } from "../src/lib/extract-errors.ts";

const err = (name: string, message: string) => Object.assign(new Error(message), { name });

test("phân loại lỗi đọc tệp theo nguyên nhân", () => {
  assert.equal(classifyReadError(err("PasswordException", "No password given")), "password");
  assert.equal(classifyReadError(err("InvalidPDFException", "Invalid PDF structure.")), "corrupt");
  assert.equal(classifyReadError(err("NotReadableError", "The requested file could not be read, typically due to permission problems")), "read");
  assert.equal(classifyReadError(err("TypeError", "undefined is not a function")), "engine");
  assert.equal(classifyReadError(err("Error", "Failed to fetch dynamically imported module")), "engine");
  assert.equal(classifyReadError(err("Error", "Can't find end of central directory : is this a zip file ?")), "corrupt");
  assert.equal(classifyReadError("lỗi lạ"), "corrupt");
});

test("chi tiết lỗi gọn và có giới hạn độ dài", () => {
  assert.ok(errorDetail(err("Error", "x".repeat(500))).length <= 140);
  assert.equal(errorDetail(err("TypeError", "a\n b")), "TypeError: a b");
});
