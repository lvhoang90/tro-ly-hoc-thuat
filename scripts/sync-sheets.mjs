// Đồng bộ một chiều Supabase → Google Sheets bằng service account (không dùng Apps Script).
// Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, SHEET_ID, [INCLUDE_CITATIONS=1]
// Không đưa abstract hay nội dung đoạn trích của người dùng vào Sheet.
import { createSign } from "node:crypto";

const env = (k, req = true) => { const v = process.env[k]; if (req && !v) throw new Error(`Thiếu biến môi trường ${k}`); return v ?? ""; };
const SUPA = env("SUPABASE_URL").replace(/\/$/, "");
const KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const SA = JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON"));
const SHEET = env("SHEET_ID");
const SHEETS = env("SHEETS_API_BASE", false) || "https://sheets.googleapis.com/v4/spreadsheets";
const TZ = "Asia/Ho_Chi_Minh", PAGE = 1000;

const b64 = (b) => Buffer.from(b).toString("base64url");
async function googleToken() {
  const now = Math.floor(Date.now() / 1000);
  const uri = SA.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({ iss: SA.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: uri, iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(SA.private_key, "base64url");
  const r = await fetch(uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }) });
  if (!r.ok) throw new Error(`Google token: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token;
}

async function fetchAll(table, select, order) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${SUPA}/rest/v1/${table}?select=${encodeURIComponent(select)}${order ? `&order=${order}` : ""}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` } });
    if (r.status !== 200 && r.status !== 206) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dt = (s) => (s ? fmt.format(new Date(s)) : "");
const day = (s) => dt(s).slice(0, 10);
const num = (x) => (x == null ? 0 : Number(x));
const join = (a) => (Array.isArray(a) ? a.join("; ") : a || "");
const round6 = (x) => Math.round(x * 1e6) / 1e6;

let token;
async function g(path, method, body) {
  const r = await fetch(`${SHEETS}/${SHEET}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Sheets ${method} ${path.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function ensureTabs(names) {
  const meta = await g("?fields=sheets.properties", "GET");
  const have = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const add = names.filter((n) => !have.has(n));
  if (add.length) {
    const res = await g(":batchUpdate", "POST", { requests: add.map((title) => ({ addSheet: { properties: { title } } })) });
    res.replies.forEach((x, i) => have.set(add[i], x.addSheet.properties.sheetId));
  }
  return have;
}

async function main() {
  token = await googleToken();
  const profiles = await fetchAll("profiles", "id,email,full_name,title,affiliation,department,position,country,orcid,research_fields,keywords,phone,scholar_url,scopus_id,website,role,status,approved,bonus_credits,lifetime_used,created_at,last_seen", "created_at.desc");
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const email = (id) => byId[id]?.email ?? id;
  const usage = await fetchAll("usage_log", "id,user_id,created_at,source,refunded,model,input_tokens,output_tokens,cost_usd,score", "created_at.desc");
  const grants = await fetchAll("credit_grants", "id,user_id,admin_id,amount,note,created_at", "created_at.desc");
  const days = await fetchAll("visit_days", "day,n", "day.desc");
  const countries = await fetchAll("visit_countries", "country,n", "n.desc");
  const settings = await fetchAll("app_settings", "key,value", "key.asc");

  const perUser = {}, perDay = {};
  for (const u of usage) {
    const a = (perUser[u.user_id] ??= { n: 0, cost: 0 });
    const d = day(u.created_at);
    const b = (perDay[d] ??= { n: 0, refunded: 0, cost: 0, tin: 0, tout: 0, scoreSum: 0, scoreN: 0 });
    if (!u.refunded) a.n++;
    a.cost += num(u.cost_usd);
    if (u.refunded) b.refunded++; else b.n++;
    b.cost += num(u.cost_usd); b.tin += num(u.input_tokens); b.tout += num(u.output_tokens);
    if (u.score != null && !u.refunded) { b.scoreSum += u.score; b.scoreN++; }
  }
  const visitBy = Object.fromEntries(days.map((r) => [r.day, num(r.n)]));

  const tabs = {
    "Người dùng": [
      ["Email", "Họ tên", "Học hàm", "Đơn vị", "Khoa/Bộ môn", "Chức vụ", "Quốc gia", "ORCID", "Lĩnh vực", "Từ khóa", "Điện thoại", "Google Scholar", "Scopus ID", "Website", "Quyền", "Trạng thái", "Đã xác nhận", "Lượt cấp thêm còn", "Tổng lượt đã dùng", "Số lần phân tích", "Chi phí API (USD)", "Ngày đăng ký", "Hoạt động gần nhất", "Mã người dùng"],
      ...profiles.map((p) => { const u = perUser[p.id] ?? { n: 0, cost: 0 };
        return [p.email, p.full_name, p.title, p.affiliation, p.department, p.position, p.country, p.orcid, join(p.research_fields), join(p.keywords), p.phone, p.scholar_url, p.scopus_id, p.website, p.role, p.status, p.approved ? "Có" : "Chưa", num(p.bonus_credits), num(p.lifetime_used), u.n, round6(u.cost), dt(p.created_at), dt(p.last_seen), p.id]; })],
    "Lượt phân tích": [
      ["Thời điểm", "Email", "Nguồn lượt", "Hoàn lượt", "Mô hình", "Token vào", "Token ra", "Chi phí (USD)", "Điểm phù hợp"],
      ...usage.map((u) => [dt(u.created_at), email(u.user_id), u.source, u.refunded ? "Có" : "", u.model, num(u.input_tokens), num(u.output_tokens), num(u.cost_usd), u.score ?? ""])],
    "Theo ngày": [
      ["Ngày", "Lượt thành công", "Lượt hoàn", "Chi phí (USD)", "Token vào", "Token ra", "Điểm trung bình", "Lượt truy cập"],
      ...Object.keys(perDay).sort().reverse().map((d) => { const x = perDay[d]; return [d, x.n, x.refunded, round6(x.cost), x.tin, x.tout, x.scoreN ? Math.round(x.scoreSum / x.scoreN) : "", visitBy[d] ?? 0]; })],
    "Cấp lượt": [["Thời điểm", "Người dùng", "Quản trị viên", "Số lượt", "Ghi chú"], ...grants.map((x) => [dt(x.created_at), email(x.user_id), x.admin_id ? email(x.admin_id) : "", num(x.amount), x.note ?? ""])],
    "Truy cập": [["Ngày", "Lượt truy cập"], ...days.map((r) => [r.day, num(r.n)])],
    "Quốc gia": [["Mã quốc gia", "Lượt truy cập"], ...countries.map((r) => [r.country, num(r.n)])],
    "Cài đặt": [["Khóa", "Giá trị"], ...settings.map((r) => [r.key, typeof r.value === "object" ? JSON.stringify(r.value) : String(r.value)])],
  };
  if (env("INCLUDE_CITATIONS", false) === "1") {
    const c = await fetchAll("citations", "id,user_id,created_at,style,cite_lang,priority,score,abstract_title", "created_at.desc");
    tabs["Trích dẫn"] = [["Thời điểm", "Email", "Đề tài", "Kiểu", "Ngôn ngữ", "Ưu tiên", "Điểm phù hợp"], ...c.map((x) => [dt(x.created_at), email(x.user_id), x.abstract_title, x.style, x.cite_lang, x.priority, x.score ?? ""])];
  }
  tabs["Đồng bộ"] = [["Lần đồng bộ gần nhất", dt(new Date())], ["Nguồn", SUPA], ["Chiều đồng bộ", "Một chiều: Supabase → Google Sheets. Sửa dữ liệu thật ở trang Quản trị của ứng dụng."],
    ...Object.entries(tabs).map(([k, v]) => [k, `${v.length - 1} dòng`])];

  const ids = await ensureTabs(Object.keys(tabs));
  const q = (n) => encodeURIComponent(`'${n}'`);
  await g("/values:batchClear", "POST", { ranges: Object.keys(tabs).map((n) => `'${n}'`) });
  await g("/values:batchUpdate", "POST", { valueInputOption: "USER_ENTERED", data: Object.entries(tabs).map(([n, v]) => ({ range: `'${n}'!A1`, values: v })) });
  // Định dạng: dòng tiêu đề đậm, đóng băng dòng đầu, tự co cột.
  await g(":batchUpdate", "POST", { requests: Object.entries(tabs).flatMap(([n, v]) => { const sheetId = ids.get(n), cols = v[0].length; return [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: n === "Đồng bộ" ? 0 : 1 } }, fields: "gridProperties.frozenRowCount" } },
    ...(n === "Đồng bộ" ? [] : [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.04, green: 0.06, blue: 0.125 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } }]),
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: cols } } }]; }) });
  void q;
  console.log("Đã đồng bộ:", Object.entries(tabs).map(([k, v]) => `${k}=${v.length - 1}`).join(", "));
}
main().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
