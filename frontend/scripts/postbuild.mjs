#!/usr/bin/env node
// next build の後に実行（npm の postbuild）。
// 公開作品・作曲家・カテゴリが 0 件のとき、静的書き出しを通すために作った仮ページ（_none）を消す。
// 消さないと /ja/scores/_none/ のような意味の無い URL が公開されてしまう。
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("out");
if (!fs.existsSync(out)) process.exit(0);
let removed = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === "_none" || e.name === "_none.txt" || e.name === "_none.html") {
      fs.rmSync(p, { recursive: true, force: true });
      removed++;
    } else if (e.isDirectory() && e.name !== "_next") walk(p);
  }
}
walk(out);
console.log(`postbuild: removed ${removed} placeholder entries (_none)`);
