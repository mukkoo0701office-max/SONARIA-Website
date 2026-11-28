import { test } from "node:test";
import assert from "node:assert/strict";
import { alternateLanguages, localeRegistry, locales, pickLocalized, stripLocale, supportedLocales } from "../src/lib/i18n.ts";
import { buildHtaccess } from "../scripts/htaccess.mjs";
import { evaluate, sourceHash } from "../scripts/translation-status.mjs";

test("公開中の言語（locales）は登録表の published と一致する", () => {
  assert.deepEqual([...locales], localeRegistry.filter((l) => l.published).map((l) => l.code));
});

test("6 言語（日英独仏西伊）を公開し、欧州 4 言語は英語で補う", () => {
  assert.deepEqual([...locales], ["ja", "en", "de", "fr", "es", "it"]);
  for (const c of ["de", "fr", "es", "it"]) {
    const l = localeRegistry.find((x) => x.code === c);
    assert.ok(l && l.published === true && l.fallback === "en", c);
  }
  assert.equal(new Set(supportedLocales).size, supportedLocales.length);
});

test("言語部分を取り除く（未公開の言語の URL も）", () => {
  assert.equal(stripLocale("/ja/scores/"), "/scores/");
  assert.equal(stripLocale("/en"), "/");
  assert.equal(stripLocale("/de/composers/bach/"), "/composers/bach/");
  assert.equal(stripLocale("/japan/"), "/japan/");
});

test("翻訳が無い項目は、補う言語 → 英語 → 日本語の順で出し、補ったことを返す", () => {
  const t = { ja: "春", en: "Spring" };
  assert.deepEqual(pickLocalized(t, "ja"), { text: "春", locale: "ja", fallback: false });
  assert.deepEqual(pickLocalized(t, "de"), { text: "Spring", locale: "en", fallback: true });
  assert.deepEqual(pickLocalized({ ...t, de: "Frühling" }, "de"), { text: "Frühling", locale: "de", fallback: false });
  assert.deepEqual(pickLocalized({ ja: "春", en: "" }, "en"), { text: "春", locale: "ja", fallback: true });
});

test("hreflang は存在する言語どうしの相互参照で、x-default は日本語のページ", () => {
  const url = (p) => `https://example.jp${p}`;
  const a = alternateLanguages("/scores/x/", ["ja", "en"], url);
  assert.deepEqual(a, { ja: "https://example.jp/ja/scores/x/", en: "https://example.jp/en/scores/x/", "x-default": "https://example.jp/ja/scores/x/" });
  // 1 言語にしかないページには hreflang を出さない
  assert.deepEqual(alternateLanguages("/composers/sevcik/", ["ja"], url), {});
  // 公開 URL が未設定なら出さない
  assert.deepEqual(alternateLanguages("/scores/", ["ja", "en"], () => null), {});
});

test(".htaccess は公開中の言語から作られ、日英では従来と同じ振り分けになる", () => {
  const h = buildHtaccess(["ja", "en"]);
  assert.match(h, /sonaria_lang=ja\(;\|\$\)\n  RewriteRule \^\$ \/ja\/ \[R=302,L\]/);
  assert.match(h, /sonaria_lang=en\(;\|\$\)\n  RewriteRule \^\$ \/en\/ \[R=302,L\]/);
  assert.match(h, /Accept-Language\} \^ja \[NC\]\n  RewriteRule \^\$ \/ja\/ \[R=302,L\]/);
  assert.match(h, /# 3\. それ以外は en\n  RewriteRule \^\$ \/en\/ \[R=302,L\]/);
  assert.doesNotMatch(h, /\/de\//);
  assert.match(h, /ErrorDocument 404 \/404\.html/);
  // 言語を公開すると振り分けも増える
  assert.match(buildHtaccess(["ja", "en", "de"]), /Accept-Language\} \^de \[NC\]\n  RewriteRule \^\$ \/de\//);
});

test("原文が変わった翻訳を「要確認」にする", () => {
  const files = { "src/data/dictionaries/en.ts": "export const en = {}" };
  const h = sourceHash("dictionary", files);
  const units = [
    { id: "dictionary:de", locale: "de", source: "dictionary", sourceHash: h, status: "published" },
    { id: "dictionary:fr", locale: "fr", source: "dictionary", sourceHash: "old", status: "review" },
    { id: "dictionary:it", locale: "it", source: "dictionary", sourceHash: "", status: "untranslated" },
  ];
  const r = evaluate(units, (s) => sourceHash(s, files));
  assert.deepEqual(r.map((x) => x.stale), [false, true, false]);
  assert.ok(sourceHash("workText:beethoven-violin-sonata-5").length === 16);
});
