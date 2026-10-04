// Sinh CHANGELOG.md (tiếng Anh, Keep a Changelog) và hai trang ghi chú phát hành tĩnh (VI, EN) từ scripts/releases.mjs.
// Chạy: npm run release:notes. Kiểm tra bản sinh còn khớp: tests/release.test.ts.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REPO, SITE, RELEASES, SECTION_VI, SECTION_ORDER } from "./releases.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const latest = RELEASES[0];
const prev = (i) => RELEASES[i + 1];
const secKeys = (r) => SECTION_ORDER.filter((k) => r.sections[k]?.length);

function changelog() {
  const out = ["# Changelog", "",
    "All notable changes to AI Academic Agent (Trợ lý học thuật) are documented in this file.", "",
    "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).", "",
    "## [Unreleased]", ""];
  for (const r of RELEASES) {
    out.push(`## [${r.version}] - ${r.date}`, "", r.summary[1], "");
    for (const k of secKeys(r)) { out.push(`### ${k}`, ""); for (const [, en] of r.sections[k]) out.push(`- ${en}`); out.push(""); }
    for (const n of r.notes ?? []) if (n === r.notes[1]) out.push(`> ${n}`, "");
  }
  return out.join("\n") + "\n";
}

const T = {
  vi: {
    lang: "vi", locale: "vi_VN", path: "/ghi-chu-phat-hanh", file: "public/ghi-chu-phat-hanh.html", other: "/en/release-notes", i: 0,
    title: `Ghi chú phát hành Trợ lý học thuật: phiên bản ${latest.version}`,
    desc: `Có gì mới trong Trợ lý học thuật (AI Academic Agent) ${latest.version}: Ami, trợ lý robot đồng hành, hệ sinh thái ISA ở chân trang và lịch sử các phiên bản.`,
    h1: "Ghi chú phát hành", lead: "Lịch sử các phiên bản của Trợ lý học thuật, theo Semantic Versioning. Phiên bản mới nhất ở trên cùng.",
    home: "Trang chủ", langLabel: "English", cta: "Dùng thử miễn phí", latestL: "Mới nhất", guide: "Hướng dẫn sử dụng", guidePath: "/huong-dan",
    f: { search: "Tìm trong ghi chú phát hành...", ver: "Phiên bản", all: "Tất cả", expand: "Mở tất cả", collapse: "Thu gọn", clear: "Xóa bộ lọc", none: "Không có phiên bản nào khớp bộ lọc.", count: (n, m) => `${n}/${m} phiên bản` },
    sec: (k) => SECTION_VI[k] ?? k, foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). Bản quyền đóng.", crumb: "Ghi chú phát hành",
  },
  en: {
    lang: "en", locale: "en_US", path: "/en/release-notes", file: "public/en/release-notes.html", other: "/ghi-chu-phat-hanh", i: 1,
    title: `AI Academic Agent release notes: version ${latest.version}`,
    desc: `What's new in AI Academic Agent ${latest.version}: Ami, the friendly robot companion, the ISA ecosystem in the footer and the full version history.`,
    h1: "Release notes", lead: "The version history of AI Academic Agent, following Semantic Versioning. Newest first.",
    home: "Home", langLabel: "Tiếng Việt", cta: "Try it free", latestL: "Latest", guide: "User guide", guidePath: "/en/guide",
    f: { search: "Search the release notes...", ver: "Version", all: "All", expand: "Expand all", collapse: "Collapse", clear: "Clear filters", none: "No version matches the filters.", count: (n, m) => `${n} of ${m} versions` },
    sec: (k) => k, foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). All rights reserved.", crumb: "Release notes",
  },
};

function page(t) {
  const o = t.lang === "vi" ? T.en : T.vi, url = SITE + t.path, ourl = SITE + o.path, I = t.i;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": url, url, name: t.title, description: t.desc, inLanguage: t.lang, dateModified: latest.date,
      isPartOf: { "@type": "WebSite", name: "Trợ lý học thuật | AI Academic Agent 1.0", url: SITE + "/" },
      about: { "@type": "SoftwareApplication", name: "Trợ lý học thuật | AI Academic Agent", softwareVersion: latest.version, applicationCategory: "EducationalApplication", operatingSystem: "Web" } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: t.home, item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: t.crumb, item: url } ] } ] };
  const rel = (r, idx) => `<article id="v${r.version}" data-v="${r.version}">
<details${idx === 0 ? " open" : ""}>
<summary><h2>v${r.version} <small>${r.date}${idx === 0 ? ` · <span class="tag">${esc(t.latestL)}</span>` : ""}</small></h2></summary>
<p class="rt">${esc(r.title[I])}</p>
<p class="lead">${esc(r.summary[I])}</p>
${secKeys(r).map((k) => `<section data-type="${k}"><h3>${esc(t.sec(k))}</h3>\n<ul>\n${r.sections[k].map((x) => `<li>${esc(x[I])}</li>`).join("\n")}\n</ul></section>`).join("\n")}
${(r.notes ?? []).length ? `<p class="note">${esc(r.notes[I])}</p>\n` : ""}</details>
</article>`;
  const kinds = [...new Set(RELEASES.flatMap(secKeys))].sort((x, y) => SECTION_ORDER.indexOf(x) - SECTION_ORDER.indexOf(y));
  const tools = `<div class="tools" role="search">
<div class="row"><input id="q" type="search" aria-label="${esc(t.f.search)}" placeholder="${esc(t.f.search)}"><select id="v" aria-label="${esc(t.f.ver)}"><option value="">${esc(t.f.ver)}: ${esc(t.f.all)}</option>${RELEASES.map((r) => `<option value="${r.version}">v${r.version} (${r.date})</option>`).join("")}</select></div>
<div class="row">${kinds.map((k) => `<button type="button" class="chip" data-t="${k}" aria-pressed="false">${esc(t.sec(k))}</button>`).join("")}<button type="button" class="lnk" id="expand">${esc(t.f.expand)}</button><button type="button" class="lnk" id="collapse">${esc(t.f.collapse)}</button><button type="button" class="lnk" id="reset" hidden>${esc(t.f.clear)}</button><span id="count" aria-live="polite"></span></div>
</div>`;
  const script = `<script>
(function(){var $=function(i){return document.getElementById(i)},arts=[].slice.call(document.querySelectorAll("article")),types={},q=$("q"),v=$("v"),N=${RELEASES.length};
function norm(s){return s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/đ/g,"d").toLowerCase()}
function apply(user){var term=norm(q.value.trim()),ver=v.value,on=Object.keys(types).filter(function(k){return types[k]}),active=!!(term||ver||on.length),shown=0;
arts.forEach(function(a){var okV=!ver||a.dataset.v===ver,any=false;
[].forEach.call(a.querySelectorAll("section"),function(s){var okT=!on.length||on.indexOf(s.dataset.type)>=0,sAny=false;
[].forEach.call(s.querySelectorAll("li"),function(li){var ok=okV&&okT&&(!term||norm(li.textContent).indexOf(term)>=0);li.hidden=!ok;if(ok)sAny=true});s.hidden=!sAny;if(sAny)any=true});
a.hidden=!(okV&&any);if(!a.hidden){shown++;if(user&&active)a.querySelector("details").open=true}});
$("none").hidden=shown>0;$("reset").hidden=!active;$("count").textContent=${JSON.stringify(t.lang)}==="en"?shown+" of "+N+" versions":shown+"/"+N+" phiên bản";
var p=[];if(on.length)p.push("t="+on.join(","));if(ver)p.push("v="+ver);if(q.value.trim())p.push("q="+encodeURIComponent(q.value.trim()));try{history.replaceState(null,"",p.length?"#"+p.join("&"):location.pathname+location.search)}catch(e){}}
[].forEach.call(document.querySelectorAll(".chip"),function(b){b.onclick=function(){var k=b.dataset.t;types[k]=!types[k];b.setAttribute("aria-pressed",types[k]?"true":"false");apply(true)}});
q.oninput=function(){apply(true)};v.onchange=function(){apply(true)};
$("reset").onclick=function(){q.value="";v.value="";types={};[].forEach.call(document.querySelectorAll(".chip"),function(b){b.setAttribute("aria-pressed","false")});apply(false)};
$("expand").onclick=function(){arts.forEach(function(a){a.querySelector("details").open=true})};$("collapse").onclick=function(){arts.forEach(function(a){a.querySelector("details").open=false})};
var h=location.hash.slice(1);if(/^v\\d+\\.\\d+\\.\\d+$/.test(h)){var t=document.getElementById(h);if(t){t.querySelector("details").open=true;setTimeout(function(){t.scrollIntoView()},0)}}
else h.split("&").forEach(function(kv){var i=kv.indexOf("="),k=kv.slice(0,i),val=kv.slice(i+1);if(k==="t")val.split(",").forEach(function(x){var b=document.querySelector('.chip[data-t="'+x+'"]');if(b){types[x]=true;b.setAttribute("aria-pressed","true")}});if(k==="v"&&[].some.call(v.options,function(o){return o.value===val}))v.value=val;if(k==="q"){try{q.value=decodeURIComponent(val)}catch(e){}}});
apply(false)})();
</script>`;
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${t.lang}" href="${url}">
<link rel="alternate" hreflang="${o.lang}" href="${ourl}">
<link rel="alternate" hreflang="x-default" href="${SITE}${T.vi.path}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0a0f1e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Trợ lý học thuật | AI Academic Agent 1.0">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${o.locale}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--bg:#0a0f1e;--card:#121a34;--line:#2a3763;--text:#e6ecf8;--muted:#9aa8c4;--accent:#38bdf8;--on:#04101f}
@media (prefers-color-scheme:light){:root{--bg:#f4f7fc;--card:#fff;--line:#d3dbea;--text:#0f172a;--muted:#4b5870;--accent:#03629a;--on:#fff}}
*{box-sizing:border-box}body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--accent)}header,main,footer{max-width:820px;margin:0 auto;padding:0 16px}
header{display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:6px;font-size:.92rem;flex-wrap:wrap;gap:.5rem}
h1{font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.2;margin:.8rem 0 .4rem}h2{font-size:1.5rem;margin:0 0 .2rem}h2 small{font-size:.9rem;font-weight:500;color:var(--muted)}h3{font-size:1.02rem;margin:1.1rem 0 .3rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.lead{color:var(--muted);font-size:1.05rem;margin:.2rem 0 1rem}.rt{font-weight:700;font-size:1.1rem;margin:.2rem 0}.btn{display:inline-block;background:var(--accent);color:var(--on);font-weight:700;padding:.7rem 1.3rem;border-radius:12px;text-decoration:none}
article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.2rem 1.3rem;margin:1.2rem 0}article ul{margin:.3rem 0;padding-left:1.2rem}article li{margin:.35rem 0}
.tag{background:var(--accent);color:var(--on);font-weight:800;border-radius:99px;padding:.05rem .6rem;font-size:.78rem}.note{color:var(--muted);font-size:.92rem}
.tools{position:sticky;top:0;z-index:5;background:var(--bg);padding:.6rem 0;border-bottom:1px solid var(--line)}.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.row+.row{margin-top:.5rem}
.tools input,.tools select{font:inherit;padding:.5rem .6rem;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}.tools input{flex:1;min-width:180px}
.chip{font:inherit;font-size:.88rem;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:99px;padding:.2rem .8rem;cursor:pointer}.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on)}
.lnk{font:inherit;font-size:.88rem;background:none;border:0;color:var(--accent);cursor:pointer;text-decoration:underline}#count{margin-left:auto;color:var(--muted);font-size:.88rem}
article summary{list-style:none;cursor:pointer}article summary::-webkit-details-marker{display:none}article summary h2::before{content:"\\25B8 ";color:var(--muted)}article details[open] summary h2::before{content:"\\25BE "}
article[hidden],li[hidden],section[hidden]{display:none}
@media print{.tools{display:none}details>*{display:block!important}}
footer{padding-top:2rem;padding-bottom:2rem;color:var(--muted);font-size:.88rem}
</style>
</head>
<body>
<header><a href="/">${esc(t.home)}</a><span><a href="${t.guidePath}">${esc(t.guide)}</a> · <a href="${o.path}" hreflang="${o.lang}" lang="${o.lang}">${esc(t.langLabel)}</a></span></header>
<main>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<p><a class="btn" href="/">${esc(t.cta)}</a></p>
${tools}
${RELEASES.map(rel).join("\n")}
<p class="note" id="none" hidden>${esc(t.f.none)}</p>
</main>
<footer>${esc(t.foot)}</footer>
${script}
</body>
</html>
`;
}

export function render() {
  return { "CHANGELOG.md": changelog(), [T.vi.file]: page(T.vi), [T.en.file]: page(T.en) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [f, c] of Object.entries(render())) writeFileSync(f, c);
  console.log("ok");
}
