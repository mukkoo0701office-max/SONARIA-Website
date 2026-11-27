import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesPlayers, matchesSheet, sheetTypeOf } from "../src/lib/scores/sheetType.ts";

test("譜面の種類はファイルの part から判定する", () => {
  assert.equal(sheetTypeOf(["score"]), "score");
  assert.equal(sheetTypeOf(["violin1", "violin2", "viola", "cello"]), "parts");
  assert.equal(sheetTypeOf(["score", "violin1", "cello"]), "both");
  assert.equal(sheetTypeOf([]), null);
});

test("スコアだけの作品をパート譜ありにしない", () => {
  assert.equal(matchesSheet("score", "parts"), false);
  assert.equal(matchesSheet("score", "both"), false);
  assert.equal(matchesSheet("score", "score"), true);
});

test("両方ある作品はスコア・パート譜・両方ありのどれにも一致する", () => {
  for (const f of ["all", "score", "parts", "both"]) assert.equal(matchesSheet("both", f), true);
  assert.equal(matchesSheet("parts", "score"), false);
  assert.equal(matchesSheet(null, "score"), false);
  assert.equal(matchesSheet(undefined, "all"), true);
});

test("演奏人数の 5 は 5 人以上", () => {
  assert.equal(matchesPlayers(5, "5"), true);
  assert.equal(matchesPlayers(8, "5"), true);
  assert.equal(matchesPlayers(4, "5"), false);
  assert.equal(matchesPlayers(2, "2"), true);
  assert.equal(matchesPlayers(3, "2"), false);
  assert.equal(matchesPlayers(3, "all"), true);
});
