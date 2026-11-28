import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_PRICES, computeQuote, currentPrices, formatMoney, quoteInputFromPayload, regionFromPayload } from "../src/lib/orders/priceEngine.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const TODAY = "2026-11-28";

test("料金エンジンは画面とサーバーで同じファイル", () => {
  const a = fs.readFileSync(path.join(repo, "frontend/src/lib/orders/priceEngine.ts"), "utf8");
  const b = fs.readFileSync(path.join(repo, "supabase/functions/_shared/pricing.ts"), "utf8");
  assert.equal(a, b, "supabase/functions/_shared/pricing.ts をコピーして frontend/src/lib/orders/priceEngine.ts を更新すること");
});

test("初期の料金はデータベースの初期データと一致する", () => {
  const sql = fs.readFileSync(path.join(repo, "supabase/migrations/20261128000005_pricing_payments.sql"), "utf8");
  const rows = [...sql.matchAll(/\('(\w+)', '(\w+)', '(\w+)', (null|\d+), (null|\d+), '([\d-]+)'\)/g)].map((m) => ({
    service: m[1],
    item: m[2],
    mode: m[3],
    jpy: m[4] === "null" ? null : Number(m[4]),
    usd_cents: m[5] === "null" ? null : Number(m[5]),
    effective_from: m[6],
    active: true,
  }));
  assert.deepEqual(rows, [...SEED_PRICES]);
});

test("運指・運弓 5 ページ: 日本 5,000 円、海外 75 USD（指示書の例）", () => {
  const input = { service: "bowing", type: "bowing", pages: 5, delivery: "threePlus" };
  const jp = computeQuote(input, SEED_PRICES, "jp", TODAY);
  const intl = computeQuote(input, SEED_PRICES, "intl", TODAY);
  assert.ok(jp.ok && intl.ok);
  assert.equal(jp.currency, "JPY");
  assert.equal(jp.total, 5000);
  assert.equal(intl.currency, "USD");
  assert.equal(intl.total, 7500);
});

test("運指＋運弓・翌日納品は ×1.2（USD はセントで四捨五入）", () => {
  const q = computeQuote({ service: "bowing", type: "both", pages: 3, delivery: "nextDay" }, SEED_PRICES, "intl", TODAY);
  assert.ok(q.ok);
  assert.equal(q.base, 6600);
  assert.equal(q.total, 7920); // $79.20
  assert.equal(formatMoney(q.total, "USD"), "$79.20");
  const jp = computeQuote({ service: "bowing", type: "both", pages: 3, delivery: "twoDays" }, SEED_PRICES, "jp", TODAY);
  assert.ok(jp.ok);
  assert.equal(jp.total, 4950);
  assert.equal(formatMoney(jp.total, "JPY"), "¥4,950");
});

test("録音: Vn 9,000円/60 USD、外注 14,000円/95 USD", () => {
  const input = { service: "recording", tracks: { violin: 2, viola: 0, cello: 1, other: 0 }, delivery: "threePlus" };
  const jp = computeQuote(input, SEED_PRICES, "jp", TODAY);
  const intl = computeQuote(input, SEED_PRICES, "intl", TODAY);
  assert.ok(jp.ok && intl.ok);
  assert.equal(jp.total, 32000);
  assert.equal(intl.total, 21500);
  assert.equal(jp.lines.length, 2);
});

test("レッスンは日本のみ・演奏依頼は見積もり制（金額を作らない）", () => {
  assert.equal(computeQuote({ service: "lesson", plan: "single" }, SEED_PRICES, "jp", TODAY).ok, true);
  const l = computeQuote({ service: "lesson", plan: "single" }, SEED_PRICES, "intl", TODAY);
  assert.deepEqual([l.ok, l.ok ? "" : l.reason], [false, "unavailable"]);
  const p = computeQuote({ service: "performance" }, SEED_PRICES, "jp", TODAY);
  assert.deepEqual([p.ok, p.ok ? "" : p.reason], [false, "quote_required"]);
});

test("不正な入力は金額を作らない（0 ページ・負の数・小数・未知の納期・未知の楽器）", () => {
  for (const input of [
    { service: "bowing", type: "bowing", pages: 0, delivery: "threePlus" },
    { service: "bowing", type: "bowing", pages: -1, delivery: "threePlus" },
    { service: "bowing", type: "bowing", pages: 1.5, delivery: "threePlus" },
    { service: "bowing", type: "bowing", pages: 1, delivery: "now" },
    { service: "recording", tracks: { violin: 0 }, delivery: "threePlus" },
    { service: "recording", tracks: { piano: 1 }, delivery: "threePlus" },
  ]) {
    assert.equal(computeQuote(input, SEED_PRICES, "jp", TODAY).ok, false, JSON.stringify(input));
  }
});

test("料金の改定: 有効開始日から新しい金額。過去の日付の計算は変わらない。無効にした行は使わない", () => {
  const rows = [...SEED_PRICES, { service: "bowing", item: "bowing", mode: "per_unit", jpy: 1200, usd_cents: 1800, effective_from: "2027-04-01", active: true }];
  const input = { service: "bowing", type: "bowing", pages: 1, delivery: "threePlus" };
  assert.equal(computeQuote(input, rows, "jp", "2027-03-31").total, 1000);
  assert.equal(computeQuote(input, rows, "jp", "2027-04-01").total, 1200);
  const off = [...SEED_PRICES, { service: "bowing", item: "bowing", mode: "per_unit", jpy: 1000, usd_cents: 1500, effective_from: "2027-01-01", active: false }];
  assert.equal(computeQuote(input, off, "jp", "2027-01-02").ok, false);
  assert.equal(currentPrices(off, "2026-12-31").get("bowing:bowing")?.jpy, 1000);
});

test("送信内容から計算の入力と請求先を読む", () => {
  const p = { service: "bowing", billingRegion: "intl", bowing: { type: "both", pages: 2, delivery: "twoDays" } };
  assert.deepEqual(quoteInputFromPayload(p), { service: "bowing", type: "both", pages: 2, delivery: "twoDays" });
  assert.equal(regionFromPayload(p), "intl");
  assert.equal(regionFromPayload({ billingRegion: "US" }), null);
  assert.deepEqual(quoteInputFromPayload({ kind: "performance_quote" }), { service: "performance" });
  assert.equal(quoteInputFromPayload(null), null);
});

test("config.ts の円の価格と納期係数は料金エンジンの初期値と一致する", async () => {
  const cfg = await import("../src/data/orders/config.ts");
  const { DELIVERY_FACTOR_TENTHS } = await import("../src/lib/orders/priceEngine.ts");
  const jpy = (service, item) => SEED_PRICES.find((r) => r.service === service && r.item === item).jpy;
  for (const k of ["bowing", "fingering", "both"]) assert.equal(cfg.bowingUnitPrice[k], jpy("bowing", k), k);
  for (const i of cfg.recordingInstruments) assert.equal(i.unitPrice, jpy("recording", i.id), i.id);
  for (const p of cfg.lessonPlans) assert.equal(p.price, jpy("lesson", p.id), p.id);
  for (const o of cfg.deliveryOptions) assert.equal(o.factorTenths, DELIVERY_FACTOR_TENTHS[o.id], o.id);
});
