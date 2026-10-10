// ISA Connect: mã ký từ Ami phải được ProFind chấp nhận (kiểm tra bằng đúng cách xác minh của ProFind api/account.js).
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { PHONE_RE, connectUrl, linkStatus, normPhone, plainProfindUrl, secretOk, signConnect } from "../api/_lib/connect.ts";

const SECRET = "x".repeat(32);
const verify = (t: string, secret: string, now = Date.now()) => { // bản chép logic xác minh của ProFind
  const [ver, pl, sig] = t.split(".");
  const want = createHmac("sha256", secret).update(`v1.${pl}`).digest("hex");
  if (ver !== "v1" || !pl || !sig || sig !== want) return null;
  const p = JSON.parse(Buffer.from(pl, "base64url").toString());
  if (!(Number(p.exp) > now) || Number(p.exp) - now > 15 * 60e3 || !/^[a-f0-9]{16,64}$/.test(String(p.jti || ""))) return null;
  return p;
};

test("mã ký hợp lệ: đúng chữ ký, hạn 10 phút, jti ngẫu nhiên, đồng ý, nguồn ami", () => {
  const t = signConnect(SECRET, { email: " A@Uni.edu.vn ", name: "Nguyễn Văn An", phone: "+84 912.345.678", lang: "vi", authorId: "A5053495766", org: "ĐH A", job: "Giảng viên" });
  const p = verify(t, SECRET)!;
  assert.ok(p, "ProFind phải chấp nhận");
  assert.deepEqual([p.e, p.n, p.ph, p.cs, p.lg, p.a, p.o, p.j, p.src], ["a@uni.edu.vn", "Nguyễn Văn An", "84912345678", true, "vi", "A5053495766", "ĐH A", "Giảng viên", "ami"]);
  assert.notEqual(signConnect(SECRET, { email: "a@b.vn", name: "x", lang: "en" }), signConnect(SECRET, { email: "a@b.vn", name: "x", lang: "en" }), "jti khác nhau mỗi lần");
  assert.equal(verify(t, "y".repeat(32)), null, "sai khoá thì bị từ chối");
  assert.equal(verify(t, SECRET, Date.now() + 16 * 60e3), null, "quá hạn");
  assert.equal(verify(t.replace(/\.[0-9a-f]+$/, ".00"), SECRET), null, "sai chữ ký");
});

test("mã không mang dữ liệu thừa và mã hồ sơ lạ bị bỏ", () => {
  const p = verify(signConnect(SECRET, { email: "a@b.vn", name: "x", lang: "vi", authorId: "<script>" }), SECRET)!;
  assert.equal(p.a, undefined); assert.equal(p.ph, undefined);
  assert.deepEqual(Object.keys(p).sort(), ["cs", "e", "exp", "j", "jti", "lg", "n", "o", "src"].sort());
});

test("số điện thoại và địa chỉ", () => {
  assert.ok(PHONE_RE.test(normPhone("0912 345 678")) && PHONE_RE.test(normPhone("+84 912345678")));
  assert.ok(!PHONE_RE.test("0212345678") && !PHONE_RE.test("091234567"));
  assert.ok(secretOk("x".repeat(16)) && !secretOk("short") && !secretOk(undefined));
  assert.match(connectUrl("v1.a.b"), /^https:\/\/profind\.isavn\.edu\.vn\/#\/ket-noi\?t=v1\.a\.b&from=ami$/);
  assert.match(plainProfindUrl("A123456"), /utm_source=ami.*#\/tac-gia\/A123456$/);
  assert.doesNotMatch(plainProfindUrl("<x>"), /tac-gia/);
});

test("linkStatus ký đúng HMAC('ls:'+email+':'+ts) và chịu lỗi mạng", async () => {
  let seen: URL | null = null;
  const ok = (async (u: URL) => { seen = u; return new Response(JSON.stringify({ registered: true, verified: false, pending: true })); }) as unknown as typeof fetch;
  const r = await linkStatus(SECRET, "A@B.vn", ok, 1_700_000_000_000);
  assert.deepEqual(r, { registered: true, verified: false, pending: true });
  const u = seen as unknown as URL;
  assert.equal(u.searchParams.get("e"), "a@b.vn");
  assert.equal(u.searchParams.get("sig"), createHmac("sha256", SECRET).update("ls:a@b.vn:1700000000000").digest("hex"));
  assert.equal(await linkStatus(SECRET, "a@b.vn", (async () => { throw new Error("net"); }) as unknown as typeof fetch), null);
  assert.equal(await linkStatus(SECRET, "a@b.vn", (async () => new Response("", { status: 503 })) as unknown as typeof fetch), null);
});
