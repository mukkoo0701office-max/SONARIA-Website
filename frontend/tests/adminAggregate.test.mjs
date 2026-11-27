import { test } from "node:test";
import assert from "node:assert/strict";
import { bucket, changeRatio, lastDays, lastMonths, revenueByPeriod, summarizeRevenue, trafficByDay } from "../src/admin/aggregate.ts";

const entry = (o) => ({ id: "x", category: "lesson", amount: 0, currency: "JPY", occurredOn: "2026-11-01", fee: 0, expense: 0, refund: 0, paymentStatus: "paid", source: "manual", certainty: "confirmed", ...o });

test("粗利益は 売上 − 返金 − 手数料 − 経費", () => {
  const s = summarizeRevenue([entry({ amount: 10000, fee: 360, expense: 1000 }), entry({ amount: 5000, refund: 1000, paymentStatus: "unpaid" })]);
  assert.equal(s.gross, 15000);
  assert.equal(s.paid, 10000);
  assert.equal(s.unpaid, 5000);
  assert.equal(s.profit, 15000 - 1000 - 360 - 1000);
});

test("前の値が 0 なら変化率は出さない", () => {
  assert.equal(changeRatio(100, 0), null);
  assert.equal(changeRatio(150, 100), 0.5);
});

test("期間の並びは古い順で、年をまたぐ", () => {
  assert.deepEqual(lastMonths(new Date(2026, 0, 15), 3), ["2025-11", "2025-12", "2026-01"]);
  assert.deepEqual(lastDays(new Date(2026, 2, 1), 2), ["2026-02-28", "2026-03-01"]);
});

test("カテゴリー別・月別の集計は範囲外を数えない", () => {
  const t = revenueByPeriod(
    [entry({ amount: 100, occurredOn: "2026-10-03" }), entry({ amount: 50, occurredOn: "2026-11-09" }), entry({ amount: 999, occurredOn: "2025-01-01" })],
    ["2026-10", "2026-11"],
    (e) => e.occurredOn.slice(0, 7),
    ["lesson", "adsense"],
  );
  assert.deepEqual(t.lesson, [100, 50]);
  assert.deepEqual(t.adsense, [0, 0]);
});

test("日別のアクセスを週・月にまとめる", () => {
  const days = lastDays(new Date(2026, 10, 14), 14);
  const { pv } = trafficByDay([{ date: days[0], pageviews: 5, visitors: 3 }, { date: days[13], pageviews: 7, visitors: 4 }], days);
  assert.equal(pv[0], 5);
  assert.deepEqual(bucket(days, pv, "week").values, [5, 7]);
  assert.deepEqual(bucket(days, pv, "month").values, [12]);
});
