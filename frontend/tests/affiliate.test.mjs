// Amazon 検索リンクの組み立ての単体テスト
import assert from "node:assert/strict";
import { test } from "node:test";
import { amazonKeyword, amazonSearchUrl, mainCatalog, plainTitle } from "../src/lib/affiliate/amazonSearch.ts";

test("曲名から愛称・括弧・調性を除く", () => {
  assert.equal(plainTitle("弦楽四重奏曲 ハ長調《皇帝》"), "弦楽四重奏曲");
  assert.equal(plainTitle("ヴァイオリン・ソナタ第5番 ヘ長調《春》"), "ヴァイオリン・ソナタ第5番");
  assert.equal(plainTitle("String Quartet in C major “Emperor”"), "String Quartet");
  assert.equal(plainTitle("弦楽四重奏曲集 Op.1（第1〜3番）"), "弦楽四重奏曲集 Op.1");
  assert.equal(plainTitle("Cello Concerto No. 1 in C major"), "Cello Concerto No. 1");
});

test("作品番号は最初の番号だけ", () => {
  assert.equal(mainCatalog("Op.76-3"), "Op.76");
  assert.equal(mainCatalog("K.216, 218, 219"), "K.216");
  assert.equal(mainCatalog("Op.24"), "Op.24");
});

test("検索語と URL（トラッキング ID 付き）", () => {
  const k = amazonKeyword({ composer: "ハイドン", title: "弦楽四重奏曲 ハ長調《皇帝》", catalog: "Op.76-3" }, "pocket", "ja");
  assert.equal(k, "ハイドン 弦楽四重奏曲 Op.76 ポケットスコア");
  const u = new URL(amazonSearchUrl(k, "mukkoo-22"));
  assert.equal(u.origin + u.pathname, "https://www.amazon.co.jp/s");
  assert.equal(u.searchParams.get("k"), k);
  assert.equal(u.searchParams.get("tag"), "mukkoo-22");
  assert.equal(new URL(amazonSearchUrl("x", "")).searchParams.has("tag"), false);
});
