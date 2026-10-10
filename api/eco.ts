// Kết nối hệ sinh thái ISA từ Ami: trạng thái hồ sơ ProFind của người dùng và liên kết chuyển sang ProFind không cần nhập mã lại.
//   POST { op: "status" }                     → { enabled, registered?, verified?, authorId?, pending?, hasPhone }
//   POST { op: "connect", authorId?, phone? } → { url, signed }   (signed=false khi chưa đặt ISA_CONNECT_SECRET: chỉ mở ProFind)
// Chỉ người đã đăng nhập và xác thực email; chỉ chuyển sang ProFind khi người dùng tự bấm nút (có dòng ghi rõ thông tin được chuyển).
import { fail, json, requireUser } from "./_lib/common.ts";
import { PHONE_RE, connectUrl, linkStatus, normPhone, plainProfindUrl, secretOk, signConnect } from "./_lib/connect.ts";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  let body: { op?: string; authorId?: string; phone?: string; lang?: string };
  try { body = await request.json(); } catch { return fail("bad_request", 400); }
  const secret = process.env.ISA_CONNECT_SECRET;

  const { data: p } = await auth.sb.from("profiles").select("full_name,affiliation,position,phone").eq("id", auth.id).single();
  const stored = normPhone(p?.phone);
  const hasPhone = PHONE_RE.test(stored);

  if (body.op === "status") {
    if (!secretOk(secret)) return json({ enabled: false, hasPhone });
    const st = await linkStatus(secret, auth.email);
    return json({ enabled: true, hasPhone, ...(st ?? { registered: null }) });
  }

  if (body.op === "connect") {
    if (!secretOk(secret)) return json({ url: plainProfindUrl(body.authorId), signed: false });
    const st = await linkStatus(secret, auth.email);
    const phone = body.phone ? normPhone(body.phone) : stored;
    // Người dùng mới của ProFind cần số di động Việt Nam để tạo tài khoản; đã có tài khoản thì không cần.
    if (st && !st.registered && !PHONE_RE.test(phone)) return json({ error: "need_phone" }, 422);
    const token = signConnect(secret, {
      email: auth.email, name: p?.full_name ?? "", phone: PHONE_RE.test(phone) ? phone : undefined, lang: body.lang === "en" ? "en" : "vi",
      authorId: body.authorId, org: p?.affiliation ?? "", job: p?.position ?? "",
    });
    return json({ url: connectUrl(token), signed: true });
  }
  return fail("bad_request", 400);
}

export const GET = () => json({ ok: true, enabled: secretOk(process.env.ISA_CONNECT_SECRET) });
