// 集計の純粋な関数（画面から切り離してテストする。tests/adminAggregate.test.mjs）。
// 注: node のテストから直接読み込むため、型以外の import は書かない

import type { AnalyticsMetric, RevenueCategory, RevenueEntry } from "./types";

export const ym = (iso: string) => iso.slice(0, 7);

/** 直近 n か月の YYYY-MM（古い順） */
export function lastMonths(today: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 直近 n 日の YYYY-MM-DD（古い順） */
export function lastDays(today: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export type RevenueSummary = { gross: number; paid: number; unpaid: number; expense: number; fee: number; refund: number; profit: number };

/** 収益の集計。粗利益 = 売上 − 返金 − 手数料 − 経費 */
export function summarizeRevenue(entries: readonly RevenueEntry[]): RevenueSummary {
  const s = { gross: 0, paid: 0, unpaid: 0, expense: 0, fee: 0, refund: 0, profit: 0 };
  for (const e of entries) {
    s.gross += e.amount;
    if (e.paymentStatus === "paid") s.paid += e.amount;
    else if (e.paymentStatus === "unpaid") s.unpaid += e.amount;
    s.expense += e.expense;
    s.fee += e.fee;
    s.refund += e.refund;
  }
  s.profit = s.gross - s.refund - s.fee - s.expense;
  return s;
}

/** 変化率（前の値が 0 なら null） */
export function changeRatio(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

/** 期間ごと × カテゴリーごとの売上 */
export function revenueByPeriod(entries: readonly RevenueEntry[], keys: readonly string[], keyOf: (e: RevenueEntry) => string, categories: readonly RevenueCategory[]) {
  const table: Record<RevenueCategory, number[]> = Object.fromEntries(categories.map((c) => [c, keys.map(() => 0)])) as Record<RevenueCategory, number[]>;
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const e of entries) {
    const i = index.get(keyOf(e));
    if (i === undefined || !table[e.category]) continue;
    table[e.category][i] += e.amount;
  }
  return table;
}

/** 日ごとの PV・訪問者 */
export function trafficByDay(metrics: readonly AnalyticsMetric[], days: readonly string[]) {
  const index = new Map(days.map((d, i) => [d, i]));
  const pv = days.map(() => 0);
  const visitors = days.map(() => 0);
  for (const m of metrics) {
    const i = index.get(m.date);
    if (i === undefined) continue;
    pv[i] += m.pageviews;
    visitors[i] += m.visitors;
  }
  return { pv, visitors };
}

/** 日ごとの値を週（7 日ずつ）・月にまとめる */
export function bucket(days: readonly string[], values: readonly number[], by: "day" | "week" | "month") {
  if (by === "day") return { labels: [...days], values: [...values] };
  const labels: string[] = [];
  const out: number[] = [];
  days.forEach((d, i) => {
    const key = by === "month" ? d.slice(0, 7) : days[Math.floor(i / 7) * 7];
    if (labels[labels.length - 1] !== key) {
      labels.push(key);
      out.push(0);
    }
    out[out.length - 1] += values[i];
  });
  return { labels, values: out };
}
