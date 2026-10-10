// Kiểm tra SEO kỹ thuật: thẻ meta, dữ liệu có cấu trúc, sitemap, robots và hreflang của các trang tĩnh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const SITE = "https://aaa.isavietnam.app";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const meta = (html: string, re: RegExp) => html.match(re)?.[1] ?? "";
const pages: Record<string, string> = { "/": "index.html", "/huong-dan": "public/huong-dan.html", "/en/guide": "public/en/guide.html", "/ghi-chu-phat-hanh": "public/ghi-chu-phat-hanh.html", "/en/release-notes": "public/en/release-notes.html", "/quyen-rieng-tu": "public/quyen-rieng-tu.html", "/en/privacy": "public/en/privacy.html" };

for (const [path, file] of Object.entries(pages)) {
  const html = read(file);
  test(`${path}: tiêu đề, mô tả, canonical và robots hợp lệ`, () => {
    const title = meta(html, /<title>([^<]+)<\/title>/);
    const desc = meta(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(title.length >= 20 && title.length <= 65, `title ${title.length} ký tự: ${title}`);
    assert.ok(desc.length >= 110 && desc.length <= 175, `description ${desc.length} ký tự`);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), SITE + (path === "/" ? "/" : path));
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, "đúng một thẻ h1");
    assert.match(html, /<meta property="og:image" content="https:\/\/aaa\.isavietnam\.app\/og\.png"/);
  });
  test(`${path}: JSON-LD phân tích được`, () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length >= 1);
    for (const b of blocks) JSON.parse(b[1]);
  });
}

test("trang hướng dẫn: hreflang hai chiều và khớp sitemap", () => {
  const vi = read(pages["/huong-dan"]), en = read(pages["/en/guide"]);
  for (const html of [vi, en]) {
    assert.match(html, new RegExp(`hreflang="vi" href="${SITE}/huong-dan"`));
    assert.match(html, new RegExp(`hreflang="en" href="${SITE}/en/guide"`));
    assert.match(html, new RegExp(`hreflang="x-default" href="${SITE}/huong-dan"`));
  }
  assert.match(vi, /<html lang="vi">/); assert.match(en, /<html lang="en">/);
});

test("sitemap: mọi URL có tệp tương ứng, robots trỏ tới sitemap", () => {
  const sm = read("public/sitemap.xml");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(new Set(locs), new Set(Object.keys(pages).map((p) => SITE + (p === "/" ? "/" : p))));
  for (const p of Object.keys(pages)) assert.ok(existsSync(new URL(`../${pages[p]}`, import.meta.url)));
  const robots = read("public/robots.txt");
  assert.match(robots, /Sitemap: https:\/\/aaa\.isavietnam\.app\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
});

test("trang hướng dẫn: FAQ và các bước khớp dữ liệu có cấu trúc", () => {
  for (const f of ["public/huong-dan.html", "public/en/guide.html"]) {
    const html = read(f);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1])].flat());
    const faq = ld.find((x) => x["@type"] === "FAQPage"), how = ld.find((x) => x["@type"] === "HowTo");
    assert.equal(faq.mainEntity.length, (html.match(/<details>/g) ?? []).length);
    assert.equal(how.step.length, (html.match(/<li><b>/g) ?? []).length);
  }
});

test("liên kết nội bộ trong trang tĩnh trỏ tới tệp tồn tại", () => {
  for (const f of ["public/huong-dan.html", "public/en/guide.html"]) {
    for (const m of read(f).matchAll(/href="(\/[^"#]*)"/g)) {
      const p = m[1];
      const ok = p === "/" || ["/huong-dan", "/en/guide", "/ghi-chu-phat-hanh", "/en/release-notes", "/quyen-rieng-tu", "/en/privacy"].includes(p) || existsSync(new URL(`../public${p}`, import.meta.url));
      assert.ok(ok, `${f}: ${p}`);
    }
  }
});

// ---- Kiểm tra SEO mở rộng: tiêu đề/mô tả không trùng, ảnh có alt và kích thước, neo trong trang, thứ bậc tiêu đề, ảnh chia sẻ ----
import { statSync } from "node:fs";
const allHtml = Object.entries(pages).map(([path, file]) => ({ path, file, html: read(file) }));

test("tiêu đề và mô tả của các trang không trùng nhau", () => {
  const titles = allHtml.map((p) => meta(p.html, /<title>([^<]+)<\/title>/)), descs = allHtml.map((p) => meta(p.html, /<meta name="description" content="([^"]+)"/));
  assert.equal(new Set(titles).size, titles.length, "tiêu đề trùng");
  assert.equal(new Set(descs).size, descs.length, "mô tả trùng");
});

test("ảnh chia sẻ là PNG 1200x630 và mọi trang trỏ tới nó với kích thước và mô tả", () => {
  const buf = readFileSync(new URL("../public/og.png", import.meta.url));
  assert.equal(buf.readUInt32BE(16), 1200); assert.equal(buf.readUInt32BE(20), 630);
  assert.ok(buf.length < 700_000, "og.png quá nặng");
  for (const p of allHtml) {
    assert.match(p.html, /og:image:width" content="1200"/, `${p.path}: og:image:width`);
    assert.match(p.html, /og:image:height" content="630"/, `${p.path}: og:image:height`);
    assert.match(p.html, /og:image:alt"/, `${p.path}: og:image:alt`);
  }
});

test("trang hướng dẫn: ảnh có alt, kích thước, tải lười, tệp tồn tại và nhẹ; id không trùng; neo trong trang hợp lệ", () => {
  for (const f of ["public/huong-dan.html", "public/en/guide.html"]) {
    const html = read(f);
    const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]).filter((t) => t.includes("/guide/"));
    assert.ok(imgs.length >= 17, `${f}: thiếu ảnh minh họa`);
    for (const t of imgs) {
      assert.match(t, /alt="[^"]{8,}"/, `${f}: ảnh thiếu alt`); assert.match(t, /width="\d+" height="\d+"/, `${f}: ảnh thiếu kích thước`); assert.match(t, /loading="lazy"/);
      const src = t.match(/src="([^"]+)"/)![1];
      assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)), `${f}: không có ${src}`);
      assert.ok(statSync(new URL(`../public${src}`, import.meta.url)).size < 150_000, `${src} quá nặng`);
    }
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${f}: id trùng`);
    for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `${f}: neo #${m[1]} không tồn tại`);
  }
});

test("thứ bậc tiêu đề không nhảy cấp ở các trang tĩnh", () => {
  for (const p of allHtml.filter((x) => x.file.startsWith("public/"))) {
    let last = 0;
    for (const m of p.html.matchAll(/<h([1-6])[ >]/g)) { const n = Number(m[1]); assert.ok(n <= last + 1, `${p.path}: h${n} sau h${last}`); last = n; }
  }
});

test("dữ liệu có cấu trúc của hướng dẫn: mỗi bước có ảnh tồn tại; trang chủ nêu Giáo sư phản biện", () => {
  for (const f of ["public/huong-dan.html", "public/en/guide.html"]) {
    const ld = [...read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1])].flat());
    const how = ld.find((x) => x["@type"] === "HowTo");
    for (const st of how.step) { assert.ok(st.image.startsWith(SITE + "/guide/")); assert.ok(existsSync(new URL(`../public${st.image.slice(SITE.length)}`, import.meta.url)), st.image); assert.ok(st.url.startsWith(SITE)); }
  }
  assert.match(read("index.html"), /Giáo sư phản biện/);
  assert.match(read("public/llms.txt"), /Giáo sư phản biện/);
});
