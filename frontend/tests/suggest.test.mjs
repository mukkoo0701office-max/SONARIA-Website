import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSuggest, suggest } from "../src/lib/scores/suggest.ts";

const works = [
  { slug: "beethoven-violin-sonata-5", title: { ja: "ヴァイオリン・ソナタ第5番《春》", en: "Violin Sonata No. 5 Spring" }, composer: { ja: "ベートーヴェン", en: "Ludwig van Beethoven" }, composerId: "beethoven", searchText: "Op.24 Frühlingssonate", hasEnglish: true },
  { slug: "beethoven-romance-2", title: { ja: "ロマンス第2番", en: "Romance No. 2" }, composer: { ja: "ベートーヴェン", en: "Ludwig van Beethoven" }, composerId: "beethoven", searchText: "Op.50", hasEnglish: true },
  { slug: "vivaldi-spring", title: { ja: "協奏曲集《四季》より「春」", en: "The Four Seasons: Spring" }, composer: { ja: "ヴィヴァルディ", en: "Antonio Vivaldi" }, composerId: "vivaldi", hasEnglish: true },
  { slug: "kreisler-romance", title: { ja: "ロマンス", en: "Romance" }, composer: { ja: "クライスラー", en: "Fritz Kreisler" }, composerId: "kreisler" },
];
const composers = [
  { id: "beethoven", name: { ja: "ベートーヴェン", en: "Ludwig van Beethoven" } },
  { id: "vivaldi", name: { ja: "ヴィヴァルディ", en: "Antonio Vivaldi" } },
  { id: "kreisler", name: { ja: "クライスラー", en: "Fritz Kreisler" } },
  { id: "nobody", name: { ja: "ベートーヴェン派", en: "No works" } },
];

test("英数字は 2 文字から、日本語は 1 文字から候補を出す", () => {
  assert.equal(shouldSuggest(""), false);
  assert.equal(shouldSuggest("b"), false);
  assert.equal(shouldSuggest("be"), true);
  assert.equal(shouldSuggest("春"), true);
});

test("作曲家は名前の一致で、作品のない作曲家は出さない", () => {
  const r = suggest("ベート", works, composers, "ja");
  assert.deepEqual(r.composers.map((c) => c.id), ["beethoven"]);
  assert.equal(r.composers[0].count, 2);
});

test("曲名で一致した作品を、作曲家名・作品番号で一致した作品より前に出す", () => {
  const r = suggest("ロマンス", works, composers, "ja");
  assert.deepEqual(r.works.map((w) => w.slug), ["kreisler-romance", "beethoven-romance-2"]);
  const r2 = suggest("beethoven", works, composers, "en");
  assert.equal(r2.works.length, 2);
});

test("作品番号・別名・全角でも一致する", () => {
  assert.deepEqual(suggest("op.24", works, composers, "ja").works.map((w) => w.slug), ["beethoven-violin-sonata-5"]);
  assert.deepEqual(suggest("ＯＰ．５０", works, composers, "ja").works.map((w) => w.slug), ["beethoven-romance-2"]);
});

test("件数の上限を守る", () => {
  const r = suggest("春", works, composers, "ja", { composers: 3, works: 1 });
  assert.equal(r.works.length, 1);
});

test("番号は数の順に並べる（第10番を第1番より前にしない）", () => {
  const ws = [10, 1, 2].map((n) => ({ slug: `s${n}`, title: { ja: `ソナタ第${n}番`, en: `Sonata No. ${n}` }, composer: { ja: "テスト", en: "Test" }, composerId: "t" }));
  assert.deepEqual(suggest("ソナタ", ws, [], "ja").works.map((w) => w.slug), ["s1", "s2", "s10"]);
});
