// Kiểm tra SEO kỹ thuật: thẻ meta, dữ liệu có cấu trúc, sitemap, robots và hreflang của các trang tĩnh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const SITE = "https://aaa.isavietnam.app";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const meta = (html: string, re: RegExp) => html.match(re)?.[1] ?? "";
const pages: Record<string, string> = { "/": "index.html", "/huong-dan": "public/huong-dan.html", "/en/guide": "public/en/guide.html" };

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
      const ok = p === "/" || ["/huong-dan", "/en/guide"].includes(p) || existsSync(new URL(`../public${p}`, import.meta.url));
      assert.ok(ok, `${f}: ${p}`);
    }
  }
});
