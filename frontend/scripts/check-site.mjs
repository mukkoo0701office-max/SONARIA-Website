#!/usr/bin/env node
// 書き出し結果（out/）の品質検査。CI で実行する。
// 調べること:
//   - 各ページの title・meta description があり、html の lang が URL の言語と一致する
//   - JSON-LD が JSON として読める
//   - サイト内リンク・画像・PDF のリンク先が実在する（リンク切れが無い）
//   - canonical・hreflang がある場合、指す先が実在する
//   - sitemap.xml の URL が実在し、noindex のページを含まない
//   - 同じ title のページが無い（作品・作曲家・カテゴリページ）
// 使い方: node scripts/check-site.mjs [out ディレクトリ]
//   環境変数 NEXT_PUBLIC_BASE_PATH・NEXT_PUBLIC_SITE_URL はビルド時と同じ値を渡す
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.argv[2] ?? "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const errors = [];
const warnings = [];
const stats = { pages: 0, workPages: 0, composerPages: 0, categoryPages: 0, jsonLd: 0, links: 0, pdfLinks: 0, sitemapUrls: 0 };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

/** サイト内の URL パス（basePath 付き）が書き出し結果に存在するか */
function exists(urlPath) {
  let p = decodeURIComponent(urlPath.split("#")[0].split("?")[0]);
  if (basePath) {
    if (!p.startsWith(basePath + "/") && p !== basePath) return false;
    p = p.slice(basePath.length) || "/";
  }
  const f = path.join(outDir, p);
  if (p.endsWith("/")) return fs.existsSync(path.join(f, "index.html"));
  return fs.existsSync(f) || fs.existsSync(path.join(f, "index.html"));
}

function fromAbsolute(u) {
  if (!siteUrl || !u.startsWith(siteUrl)) return null;
  // 公開 URL は basePath を含む（例: https://example.github.io/SONARIA-Website）
  return basePath + (u.slice(siteUrl.length) || "/");
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

const htmlFiles = walk(outDir).filter((f) => f.endsWith(".html") && !f.includes(`${path.sep}_next${path.sep}`));
const titles = new Map();
const noindexPages = new Set();

for (const file of htmlFiles) {
  const rel = "/" + path.relative(outDir, file).split(path.sep).join("/");
  const html = fs.readFileSync(file, "utf8");
  const isPage = rel.endsWith("/index.html") && /^\/(ja|en)\//.test(rel);
  if (!isPage) continue;
  const pagePath = rel.replace(/index\.html$/, "");
  const lang = pagePath.split("/")[1];
  if (pagePath.includes("/_none/")) errors.push(`${pagePath}: 仮ページ（_none）が残っています（postbuild で削除されるはず）`);
  stats.pages++;
  if (/^\/(ja|en)\/scores\/(?!category\/)[^/]+\/$/.test(pagePath)) stats.workPages++;
  if (/^\/(ja|en)\/composers\/[^/]+\/$/.test(pagePath)) stats.composerPages++;
  if (/^\/(ja|en)\/scores\/category\/[^/]+\/$/.test(pagePath)) stats.categoryPages++;

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) errors.push(`${pagePath}: title がありません`);
  else {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(pagePath);
  }
  if (!/<meta name="description" content="[^"]+"/.test(html)) errors.push(`${pagePath}: meta description がありません`);
  if (!html.includes(`<html lang="${lang}"`)) errors.push(`${pagePath}: html の lang が ${lang} ではありません`);
  if (/<meta name="robots" content="noindex/.test(html)) noindexPages.add(pagePath);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    stats.jsonLd++;
    try {
      const data = JSON.parse(m[1]);
      for (const d of [data].flat()) if (!d["@context"] || !d["@type"]) errors.push(`${pagePath}: JSON-LD に @context か @type がありません`);
    } catch {
      errors.push(`${pagePath}: JSON-LD が JSON として読めません`);
    }
  }

  for (const m of html.matchAll(/<(a|link|img|iframe)\b[^>]*>/g)) {
    const tag = m[0];
    const kind = m[1];
    const url = kind === "img" || kind === "iframe" ? attr(tag, "src") : attr(tag, "href");
    if (!url) continue;
    if (kind === "link") {
      const relAttr = attr(tag, "rel");
      if (relAttr === "canonical" || relAttr === "alternate") {
        const local = fromAbsolute(url);
        if (siteUrl && !local) errors.push(`${pagePath}: ${relAttr} が公開 URL の外を指しています: ${url}`);
        else if (local && !exists(local)) errors.push(`${pagePath}: ${relAttr} の指す先がありません: ${url}`);
        if (relAttr === "canonical" && local && local !== basePath + pagePath) errors.push(`${pagePath}: canonical が自分自身ではありません: ${url}`);
        continue;
      }
      if (relAttr !== "preload") continue;
    }
    if (!url.startsWith("/") || url.startsWith("//") || url.startsWith(`${basePath}/_next/`)) continue;
    stats.links++;
    if (url.endsWith(".pdf")) stats.pdfLinks++;
    if (!exists(url)) errors.push(`${pagePath}: リンク切れ ${url}`);
  }
}

for (const [title, pages] of titles) {
  const libraryPages = pages.filter((p) => /\/(scores|composers)\/[^/]+\//.test(p));
  if (libraryPages.length > 1) errors.push(`同じ title のページがあります「${title}」: ${libraryPages.join(", ")}`);
}

const sitemapFile = path.join(outDir, "sitemap.xml");
if (fs.existsSync(sitemapFile)) {
  const xml = fs.readFileSync(sitemapFile, "utf8");
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    stats.sitemapUrls++;
    const local = fromAbsolute(m[1]);
    if (!local) errors.push(`sitemap: 公開 URL の外の URL です: ${m[1]}`);
    else if (!exists(local)) errors.push(`sitemap: 存在しない URL です: ${m[1]}`);
    else if (noindexPages.has(local.slice(basePath.length))) errors.push(`sitemap: noindex のページが入っています: ${m[1]}`);
  }
} else warnings.push("sitemap.xml がありません");

if (!fs.existsSync(path.join(outDir, "robots.txt"))) errors.push("robots.txt がありません");

console.log(JSON.stringify({ stats, errors: errors.length, warnings }, null, 1));
for (const e of errors.slice(0, 100)) console.error("ERROR", e);
process.exit(errors.length ? 1 : 0);
