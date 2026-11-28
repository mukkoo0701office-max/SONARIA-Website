#!/usr/bin/env node
// 翻訳の状態の確認（CI で実行）。
// - 各翻訳の「翻訳したときの原文のハッシュ（sourceHash）」と、今の原文のハッシュを比べ、原文が更新された翻訳を「要確認」とする
// - 公開中（published）の翻訳が要確認になっていたら失敗する（古い訳のまま公開し続けない）
// 原文の指定（source）:
//   dictionary            … UI の英語辞書（src/data/dictionaries/en.ts）全体
//   workText:<作品ID>      … 作品の原題・別名・英語の概要（src/data/scores/workTexts.json）
// 使い方: node scripts/translation-status.mjs            … 状態の一覧
//         node scripts/translation-status.mjs --hash dictionary  … 今の原文のハッシュ
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

export function sourceHash(source, files = {}) {
  const read = (p) => files[p] ?? fs.readFileSync(path.join(root, p), "utf8");
  if (source === "dictionary") return sha(read("src/data/dictionaries/en.ts"));
  if (source.startsWith("workText:")) {
    const id = source.slice("workText:".length);
    const w = JSON.parse(read("src/data/scores/workTexts.json")).works[id];
    if (!w) throw new Error(`unknown work: ${id}`);
    return sha(JSON.stringify({ original: w.original ?? "", aliases: w.aliases ?? [], en: w.summary?.en ?? "" }));
  }
  throw new Error(`unknown source: ${source}`);
}

/** 各翻訳の状態を判定する（stale = 原文が更新された） */
export function evaluate(units, hashOf) {
  return units.map((u) => {
    const current = hashOf(u.source);
    return { ...u, current, stale: u.status !== "untranslated" && u.sourceHash !== current };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === "--hash") {
    console.log(sourceHash(args[1]));
    process.exit(0);
  }
  const status = JSON.parse(fs.readFileSync(path.join(root, "translations/status.json"), "utf8"));
  const rows = evaluate(status.units, (s) => sourceHash(s));
  const byLocale = {};
  for (const r of rows) {
    const b = (byLocale[r.locale] ??= { total: 0, stale: 0, byStatus: {} });
    b.total++;
    b.byStatus[r.status] = (b.byStatus[r.status] ?? 0) + 1;
    if (r.stale) b.stale++;
  }
  console.log("translation status:", Object.keys(byLocale).length ? JSON.stringify(byLocale) : "no translations yet");
  for (const r of rows.filter((x) => x.stale)) console.log(`STALE ${r.locale} ${r.id} (source ${r.source} changed)`);
  const bad = rows.filter((r) => r.stale && r.status === "published");
  if (bad.length) {
    console.error(`${bad.length} published translation(s) are out of date. Re-check them and update sourceHash.`);
    process.exit(1);
  }
}
