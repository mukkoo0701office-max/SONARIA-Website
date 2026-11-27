// 申込フォームの料金計算・候補日時の単体テスト（Issue #13 の受け入れテストを含む）
// 実行: node --experimental-strip-types --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { bowingUnitPrice, deliveryOptions, recordingInstruments } from "../src/data/orders/config.ts";
import { applyDelivery, clampInt, quoteBowing, quoteRecording } from "../src/lib/orders/pricing.ts";
import { candidateDays, endsAfter, isPast, tokyoNow, validCandidates } from "../src/lib/orders/schedule.ts";

const d = Object.fromEntries(deliveryOptions.map((o) => [o.id, o]));

test("納期係数: 翌日 1.2 / 翌々日 1.1 / 3 日後以降 1.0", () => {
  assert.equal(applyDelivery(10000, d.nextDay), 12000);
  assert.equal(applyDelivery(10000, d.twoDays), 11000);
  assert.equal(applyDelivery(10000, d.threePlus), 10000);
});

test("運指・運弓: 種別ごとの 1 ページ単価とセット割", () => {
  assert.equal(quoteBowing("bowing", 1, bowingUnitPrice, d.threePlus).total, 1000);
  assert.equal(quoteBowing("fingering", 1, bowingUnitPrice, d.threePlus).total, 1000);
  const both = quoteBowing("both", 1, bowingUnitPrice, d.threePlus);
  assert.equal(both.total, 1500);
  assert.equal(both.listUnitPrice, 2000);
  assert.equal(both.setDiscountPerPage, 500);
});

test("運指・運弓: 複数ページ × 納期（全組み合わせ）", () => {
  for (const type of ["bowing", "fingering", "both"]) {
    for (const pages of [1, 2, 7]) {
      for (const opt of deliveryOptions) {
        const q = quoteBowing(type, pages, bowingUnitPrice, opt);
        assert.equal(q.base, bowingUnitPrice[type] * pages);
        assert.equal(q.total, Math.round((bowingUnitPrice[type] * pages * opt.factorTenths) / 10));
      }
    }
  }
  assert.equal(quoteBowing("both", 3, bowingUnitPrice, d.nextDay).total, 5400);
});

test("録音: Vn2 + Va1 + Vc1 = 41,000 円、翌日 49,200 円", () => {
  const tracks = { violin: 2, viola: 1, cello: 1 };
  const q = quoteRecording(recordingInstruments, tracks, d.threePlus);
  assert.equal(q.base, 41000);
  assert.equal(q.total, 41000);
  assert.deepEqual(q.lines.map((l) => [l.id, l.subtotal, l.outsourced]), [["violin", 18000, false], ["viola", 9000, false], ["cello", 14000, true]]);
  assert.equal(quoteRecording(recordingInstruments, tracks, d.nextDay).total, 49200);
  assert.equal(quoteRecording(recordingInstruments, tracks, d.twoDays).total, 45100);
});

test("録音: その他は 14,000 円（外注）、0 トラックの楽器は明細に出ない", () => {
  const q = quoteRecording(recordingInstruments, { violin: 0, other: 2 }, d.threePlus);
  assert.equal(q.base, 28000);
  assert.deepEqual(q.lines.map((l) => l.id), ["other"]);
  assert.equal(q.lines[0].outsourced, true);
});

test("数量の入力は範囲内の整数に丸める", () => {
  assert.equal(clampInt("3", 1, 100), 3);
  assert.equal(clampInt(0, 1, 100), 1);
  assert.equal(clampInt(1000, 1, 100), 100);
  assert.equal(clampInt("abc", 1, 100), 1);
  assert.equal(clampInt(2.7, 1, 100), 2);
});

test("候補日: 東京時間の今日から 7 日間", () => {
  // 2026-11-27 23:30 JST = 14:30 UTC
  const now = new Date("2026-11-27T14:30:00Z");
  assert.equal(tokyoNow(now).date, "2026-11-27");
  const days = candidateDays(now, 7);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-11-27");
  assert.equal(days[6].date, "2026-12-03");
  assert.equal(days[0].weekday, 5); // 金曜
  // UTC では前日でも、東京の日付で作る（2026-11-28 08:00 JST = 2026-11-27 23:00 UTC）
  assert.equal(candidateDays(new Date("2026-11-27T23:00:00Z"), 1)[0].date, "2026-11-28");
});

test("当日の過去時刻・過去日は選べない", () => {
  const now = new Date("2026-11-27T05:10:00Z"); // 14:10 JST
  assert.equal(isPast("2026-11-27", "14:00", now), true);
  assert.equal(isPast("2026-11-27", "14:30", now), false);
  assert.equal(isPast("2026-11-26", "17:00", now), true);
  const ok = validCandidates(
    [
      { date: "2026-11-27", time: "12:00" },
      { date: "2026-11-27", time: "16:00" },
      { date: "2026-11-27", time: "16:00" },
      { date: "2026-11-28", time: "11:00" },
      { date: "2026-12-10", time: "13:00" },
    ],
    candidateDays(now, 7).map((x) => x.date),
    ["12:00", "16:00", "18:00"],
    now,
  );
  assert.deepEqual(ok, [{ date: "2026-11-27", time: "16:00" }]);
});

test("終了が 18:00 を過ぎる開始時刻を判定する（所要時間が不明なら 18:00 開始だけ）", () => {
  assert.equal(endsAfter("17:00", 60, "18:00"), false);
  assert.equal(endsAfter("17:30", 60, "18:00"), true);
  assert.equal(endsAfter("16:00", 150, "18:00"), true);
  assert.equal(endsAfter("17:30", null, "18:00"), false);
  assert.equal(endsAfter("18:00", null, "18:00"), true);
});
