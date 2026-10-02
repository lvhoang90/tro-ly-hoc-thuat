/**
 * AI Academic Agent: đồng bộ dữ liệu quản trị từ Supabase sang Google Sheets (nằm trong Google Drive của bạn).
 *
 * Cách dùng: xem docs/GOOGLE-DRIVE.md. Dán tệp này vào Apps Script gắn với một Google Sheet,
 * đặt hai "Script properties" SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY, chạy syncAll() một lần, rồi chạy setupTrigger().
 *
 * Nguyên tắc:
 *  - Chỉ ĐỌC từ Supabase và GHI ĐÈ các tab trong Sheet (một chiều). Sửa dữ liệu thật ở trang Quản trị của ứng dụng.
 *  - Không đưa nội dung abstract và đoạn trích của người dùng vào Sheet (đổi INCLUDE_CITATIONS nếu thật sự cần).
 *  - Khóa service_role chỉ nằm trong Script properties của tài khoản Google của bạn; không dán vào ô tính.
 */
const CONFIG = {
  TZ: "Asia/Ho_Chi_Minh",
  PAGE: 1000,                 // số dòng mỗi lần gọi REST
  DAILY_HOUR: 2,              // giờ chạy tự động hằng ngày (giờ Việt Nam)
  INCLUDE_CITATIONS: false,   // true: thêm tab "Trích dẫn" (nguồn, kiểu, điểm; vẫn KHÔNG gồm nội dung đoạn trích)
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Agent").addItem("Đồng bộ ngay", "syncAll").addItem("Hẹn đồng bộ hằng ngày", "setupTrigger").addToUi();
}

function props_() {
  const p = PropertiesService.getScriptProperties();
  const url = (p.getProperty("SUPABASE_URL") || "").replace(/\/$/, "");
  const key = p.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong Project Settings → Script properties.");
  return { url: url, key: key };
}

/** Lấy toàn bộ một bảng qua REST, phân trang bằng tiêu đề Range. */
function fetchAll_(table, select, order) {
  const c = props_();
  const out = [];
  for (let from = 0; ; from += CONFIG.PAGE) {
    const res = UrlFetchApp.fetch(c.url + "/rest/v1/" + table + "?select=" + encodeURIComponent(select) + (order ? "&order=" + order : ""), {
      method: "get", muteHttpExceptions: true,
      headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Range-Unit": "items", Range: from + "-" + (from + CONFIG.PAGE - 1) },
    });
    const code = res.getResponseCode();
    if (code !== 200 && code !== 206) throw new Error(table + ": HTTP " + code + " " + String(res.getContentText()).slice(0, 200));
    const rows = JSON.parse(res.getContentText());
    out.push.apply(out, rows);
    if (rows.length < CONFIG.PAGE) break;
  }
  return out;
}

function toDate_(s) { return s ? new Date(s) : ""; }
const num_ = (x) => (x == null ? 0 : Number(x));
const join_ = (a) => (Array.isArray(a) ? a.join("; ") : a || "");

function writeTab_(ss, name, header, rows, formats) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const values = [header].concat(rows);
  sh.getRange(1, 1, values.length, header.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#0b1020").setFontColor("#ffffff");
  (formats || []).forEach(function (f) { if (rows.length) sh.getRange(2, f[0], rows.length, 1).setNumberFormat(f[1]); });
  sh.autoResizeColumns(1, header.length);
  return rows.length;
}

function syncAll() {
  const ss = SpreadsheetApp.getActive();
  const profiles = fetchAll_("profiles", "id,email,full_name,title,affiliation,department,position,country,orcid,research_fields,keywords,phone,scholar_url,scopus_id,website,role,status,approved,bonus_credits,lifetime_used,created_at,last_seen", "created_at.desc");
  const byId = {};
  profiles.forEach(function (p) { byId[p.id] = p; });
  const email = function (id) { return byId[id] ? byId[id].email : id; };

  const usage = fetchAll_("usage_log", "id,user_id,created_at,source,refunded,model,input_tokens,output_tokens,cost_usd,score", "created_at.desc");
  const grants = fetchAll_("credit_grants", "id,user_id,admin_id,amount,note,created_at", "created_at.desc");
  const days = fetchAll_("visit_days", "day,n", "day.desc");
  const countries = fetchAll_("visit_countries", "country,n", "n.desc");
  const settings = fetchAll_("app_settings", "key,value", "key.asc");

  // Tổng hợp theo người dùng và theo ngày (giờ Việt Nam) từ nhật ký sử dụng.
  const perUser = {}, perDay = {};
  usage.forEach(function (u) {
    const a = perUser[u.user_id] || (perUser[u.user_id] = { n: 0, refunded: 0, cost: 0, tin: 0, tout: 0 });
    const d = Utilities.formatDate(new Date(u.created_at), CONFIG.TZ, "yyyy-MM-dd");
    const b = perDay[d] || (perDay[d] = { n: 0, refunded: 0, cost: 0, tin: 0, tout: 0, scoreSum: 0, scoreN: 0 });
    [a, b].forEach(function (x) { if (u.refunded) x.refunded++; else x.n++; x.cost += num_(u.cost_usd); x.tin += num_(u.input_tokens); x.tout += num_(u.output_tokens); });
    if (u.score != null && !u.refunded) { b.scoreSum += u.score; b.scoreN++; }
  });

  const counts = {};
  counts["Người dùng"] = writeTab_(ss, "Người dùng",
    ["Email", "Họ tên", "Học hàm", "Đơn vị", "Khoa/Bộ môn", "Chức vụ", "Quốc gia", "ORCID", "Lĩnh vực", "Từ khóa", "Điện thoại", "Google Scholar", "Scopus ID", "Website",
      "Quyền", "Trạng thái", "Đã xác nhận", "Lượt cấp thêm còn", "Tổng lượt đã dùng", "Số lần phân tích", "Chi phí API (USD)", "Ngày đăng ký", "Hoạt động gần nhất", "Mã người dùng"],
    profiles.map(function (p) {
      const u = perUser[p.id] || { n: 0, cost: 0 };
      return [p.email, p.full_name, p.title, p.affiliation, p.department, p.position, p.country, p.orcid, join_(p.research_fields), join_(p.keywords), p.phone, p.scholar_url, p.scopus_id, p.website,
        p.role, p.status, p.approved ? "Có" : "Chưa", num_(p.bonus_credits), num_(p.lifetime_used), u.n, Math.round(u.cost * 1e6) / 1e6, toDate_(p.created_at), toDate_(p.last_seen), p.id];
    }), [[21, "$0.0000"], [22, "dd/MM/yyyy HH:mm"], [23, "dd/MM/yyyy HH:mm"]]);

  counts["Lượt phân tích"] = writeTab_(ss, "Lượt phân tích",
    ["Thời điểm", "Email", "Nguồn lượt", "Hoàn lượt", "Mô hình", "Token vào", "Token ra", "Chi phí (USD)", "Điểm phù hợp"],
    usage.map(function (u) { return [toDate_(u.created_at), email(u.user_id), u.source, u.refunded ? "Có" : "", u.model, num_(u.input_tokens), num_(u.output_tokens), num_(u.cost_usd), u.score == null ? "" : u.score]; }),
    [[1, "dd/MM/yyyy HH:mm"], [8, "$0.0000"]]);

  const dayKeys = Object.keys(perDay).sort().reverse();
  counts["Theo ngày"] = writeTab_(ss, "Theo ngày",
    ["Ngày", "Lượt thành công", "Lượt hoàn", "Chi phí (USD)", "Token vào", "Token ra", "Điểm trung bình", "Lượt truy cập"],
    dayKeys.map(function (d) {
      const x = perDay[d], v = days.filter(function (r) { return r.day === d; })[0];
      return [d, x.n, x.refunded, Math.round(x.cost * 1e6) / 1e6, x.tin, x.tout, x.scoreN ? Math.round(x.scoreSum / x.scoreN) : "", v ? num_(v.n) : 0];
    }), [[4, "$0.0000"]]);

  counts["Cấp lượt"] = writeTab_(ss, "Cấp lượt", ["Thời điểm", "Người dùng", "Quản trị viên", "Số lượt", "Ghi chú"],
    grants.map(function (g) { return [toDate_(g.created_at), email(g.user_id), g.admin_id ? email(g.admin_id) : "", num_(g.amount), g.note]; }), [[1, "dd/MM/yyyy HH:mm"]]);

  counts["Truy cập"] = writeTab_(ss, "Truy cập", ["Ngày", "Lượt truy cập"], days.map(function (r) { return [r.day, num_(r.n)]; }));
  counts["Quốc gia"] = writeTab_(ss, "Quốc gia", ["Mã quốc gia", "Lượt truy cập"], countries.map(function (r) { return [r.country, num_(r.n)]; }));
  counts["Cài đặt"] = writeTab_(ss, "Cài đặt", ["Khóa", "Giá trị"], settings.map(function (r) { return [r.key, typeof r.value === "object" ? JSON.stringify(r.value) : String(r.value)]; }));

  if (CONFIG.INCLUDE_CITATIONS) {
    const cites = fetchAll_("citations", "id,user_id,created_at,style,cite_lang,priority,score,abstract_title", "created_at.desc");
    counts["Trích dẫn"] = writeTab_(ss, "Trích dẫn", ["Thời điểm", "Email", "Đề tài", "Kiểu", "Ngôn ngữ", "Ưu tiên", "Điểm phù hợp"],
      cites.map(function (c) { return [toDate_(c.created_at), email(c.user_id), c.abstract_title, c.style, c.cite_lang, c.priority, c.score == null ? "" : c.score]; }), [[1, "dd/MM/yyyy HH:mm"]]);
  }

  // Tab ghi chú thời điểm đồng bộ.
  const info = ss.getSheetByName("Đồng bộ") || ss.insertSheet("Đồng bộ");
  info.clearContents();
  const rows = [["Lần đồng bộ gần nhất", Utilities.formatDate(new Date(), CONFIG.TZ, "dd/MM/yyyy HH:mm:ss")], ["Nguồn", props_().url], ["Chiều đồng bộ", "Một chiều: Supabase → Google Sheets. Sửa dữ liệu thật ở trang Quản trị của ứng dụng."]]
    .concat(Object.keys(counts).map(function (k) { return [k, counts[k] + " dòng"]; }));
  info.getRange(1, 1, rows.length, 2).setValues(rows);
  info.getRange(1, 1, rows.length, 1).setFontWeight("bold");
  info.autoResizeColumns(1, 2);
  return counts;
}

/** Hẹn chạy syncAll mỗi ngày vào giờ cố định; chạy lại hàm này không tạo trùng lịch. */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "syncAll") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("syncAll").timeBased().everyDays(1).atHour(CONFIG.DAILY_HOUR).inTimezone(CONFIG.TZ).create();
}
