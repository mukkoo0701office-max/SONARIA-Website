// 料金エンジン（純粋関数・import なし）。
// このファイルは frontend/src/lib/orders/priceEngine.ts と同じ内容でなければならない（テストで一致を確認する）。
// - サーバー（Edge Function）: データベースの料金マスタ（public.price_items）を渡して、確定前の金額を計算する
// - 画面: 料金マスタ（取得できなければ SEED_PRICES）を渡して、表示用の金額を計算する
// 金額はすべて「最小単位の整数」: JPY は円、USD はセント。端数処理は最後に 1 回だけ（四捨五入）
// 仕様: docs/payments/PAYMENTS_DESIGN.md（2026-11-28 運営者決定: 表示価格は税込み）

export type Region = "jp" | "intl";
export type Currency = "JPY" | "USD";
export type BillingMode = "per_unit" | "fixed" | "quote";

/** 料金マスタの 1 行（public.price_items と同じ形） */
export type PriceRow = {
  service: string; // bowing / recording / lesson / performance など
  item: string; // bowing・fingering・both / violin・viola・cello・other / trial・single… / quote
  mode: BillingMode;
  jpy: number | null; // 国内（税込み・円）。null は国内で提供しない
  usd_cents: number | null; // 海外（税込み・セント）。null は海外で提供しない
  effective_from: string; // YYYY-MM-DD（この日から有効）
  active: boolean;
};

/** 初期の料金（2026-11-28 運営者決定）。データベースの初期データと同じ値（テストで一致を確認する） */
export const SEED_PRICES: readonly PriceRow[] = [
  { service: "bowing", item: "bowing", mode: "per_unit", jpy: 1000, usd_cents: 1500, effective_from: "2026-11-28", active: true },
  { service: "bowing", item: "fingering", mode: "per_unit", jpy: 1000, usd_cents: 1500, effective_from: "2026-11-28", active: true },
  { service: "bowing", item: "both", mode: "per_unit", jpy: 1500, usd_cents: 2200, effective_from: "2026-11-28", active: true },
  { service: "recording", item: "violin", mode: "per_unit", jpy: 9000, usd_cents: 6000, effective_from: "2026-11-28", active: true },
  { service: "recording", item: "viola", mode: "per_unit", jpy: 9000, usd_cents: 6000, effective_from: "2026-11-28", active: true },
  { service: "recording", item: "cello", mode: "per_unit", jpy: 14000, usd_cents: 9500, effective_from: "2026-11-28", active: true },
  { service: "recording", item: "other", mode: "per_unit", jpy: 14000, usd_cents: 9500, effective_from: "2026-11-28", active: true },
  // レッスンは東京での対面のため円のみ（Stripe 決済の対象外・2026-11-28 運営者決定）
  { service: "lesson", item: "trial", mode: "fixed", jpy: 1000, usd_cents: null, effective_from: "2026-11-28", active: true },
  { service: "lesson", item: "single", mode: "fixed", jpy: 6000, usd_cents: null, effective_from: "2026-11-28", active: true },
  { service: "lesson", item: "intensive", mode: "fixed", jpy: 11000, usd_cents: null, effective_from: "2026-11-28", active: true },
  { service: "lesson", item: "visiting", mode: "fixed", jpy: 10000, usd_cents: null, effective_from: "2026-11-28", active: true },
  // 演奏依頼は見積もり制（金額は管理人が確定する）
  { service: "performance", item: "quote", mode: "quote", jpy: null, usd_cents: null, effective_from: "2026-11-28", active: true },
];

/** 納期係数（10 倍の整数）。運指・運弓と録音で共通 */
export const DELIVERY_FACTOR_TENTHS: Readonly<Record<string, number>> = { nextDay: 12, twoDays: 11, threePlus: 10 };

export function currencyOf(region: Region): Currency {
  return region === "jp" ? "JPY" : "USD";
}

/** 表示用の書式（例: ¥1,500 / $22.00） */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "JPY") return `¥${Math.round(amount).toLocaleString("en-US")}`;
  return `$${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 指定日に有効な料金（service:item ごとに、有効開始日が指定日以前で最も新しい行。無効な行は除く） */
export function currentPrices(rows: readonly PriceRow[], today: string): Map<string, PriceRow> {
  const out = new Map<string, PriceRow>();
  for (const r of rows) {
    if (r.effective_from > today) continue;
    const k = `${r.service}:${r.item}`;
    const prev = out.get(k);
    if (!prev || r.effective_from > prev.effective_from) out.set(k, r);
  }
  for (const [k, r] of out) if (!r.active) out.delete(k);
  return out;
}

/** 地域に応じた単価（最小単位）。提供しない・見積もり制なら null */
export function unitPrice(prices: Map<string, PriceRow>, service: string, item: string, region: Region): number | null {
  const r = prices.get(`${service}:${item}`);
  if (!r || r.mode === "quote") return null;
  const v = region === "jp" ? r.jpy : r.usd_cents;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

export function applyFactor(base: number, factorTenths: number): number {
  return Math.round((base * factorTenths) / 10);
}

export type QuoteLine = { item: string; unitPrice: number; quantity: number; subtotal: number; effectiveFrom: string };
export type Quote =
  | { ok: true; service: string; region: Region; currency: Currency; lines: QuoteLine[]; base: number; factorTenths: number; total: number }
  | { ok: false; service: string; region: Region; reason: "quote_required" | "unavailable" | "invalid" };

export type QuoteInput =
  | { service: "bowing"; type: string; pages: number; delivery: string }
  | { service: "recording"; tracks: Record<string, number>; delivery: string }
  | { service: "lesson"; plan: string }
  | { service: "performance" };

const MAX_QTY = 1000;
const isQty = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_QTY;

/** 金額の計算。入力が不正・提供しない・見積もり制なら ok: false（金額を作らない） */
export function computeQuote(input: QuoteInput, rows: readonly PriceRow[], region: Region, today: string): Quote {
  const prices = currentPrices(rows, today);
  const service = input.service;
  const fail = (reason: "quote_required" | "unavailable" | "invalid"): Quote => ({ ok: false, service, region, reason });
  const line = (item: string, quantity: number): QuoteLine | null => {
    const p = unitPrice(prices, service, item, region);
    if (p == null) return null;
    return { item, unitPrice: p, quantity, subtotal: p * quantity, effectiveFrom: prices.get(`${service}:${item}`)!.effective_from };
  };
  const done = (lines: QuoteLine[], factorTenths: number): Quote => {
    const base = lines.reduce((n, l) => n + l.subtotal, 0);
    return { ok: true, service, region, currency: currencyOf(region), lines, base, factorTenths, total: applyFactor(base, factorTenths) };
  };

  if (input.service === "performance") return fail("quote_required");

  if (input.service === "bowing") {
    const f = DELIVERY_FACTOR_TENTHS[input.delivery];
    if (!f || !isQty(input.pages) || input.pages < 1) return fail("invalid");
    const l = line(input.type, input.pages);
    return l ? done([l], f) : fail("unavailable");
  }

  if (input.service === "recording") {
    const f = DELIVERY_FACTOR_TENTHS[input.delivery];
    if (!f || typeof input.tracks !== "object" || input.tracks === null) return fail("invalid");
    const lines: QuoteLine[] = [];
    for (const [item, qty] of Object.entries(input.tracks)) {
      if (!isQty(qty)) return fail("invalid");
      if (qty === 0) continue;
      const l = line(item, qty);
      if (!l) return fail("unavailable");
      lines.push(l);
    }
    return lines.length ? done(lines, f) : fail("invalid");
  }

  if (input.service === "lesson") {
    const l = line(input.plan, 1);
    return l ? done([l], 10) : fail("unavailable");
  }

  return fail("invalid");
}

/** フォームの送信内容（payload）から計算の入力を作る。読めなければ null */
export function quoteInputFromPayload(payload: unknown): QuoteInput | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const obj = (v: unknown) => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  if (p.kind === "performance_quote") return { service: "performance" };
  if (p.service === "bowing") {
    const b = obj(p.bowing);
    if (!b) return null;
    return { service: "bowing", type: String(b.type ?? ""), pages: Number(b.pages), delivery: String(b.delivery ?? "") };
  }
  if (p.service === "recording") {
    const r = obj(p.recording);
    const t = r && obj(r.tracks);
    if (!r || !t) return null;
    const tracks: Record<string, number> = {};
    for (const [k, v] of Object.entries(t)) tracks[k] = Number(v);
    return { service: "recording", tracks, delivery: String(r.delivery ?? "") };
  }
  if (p.service === "lesson") {
    const l = obj(p.lesson);
    return l ? { service: "lesson", plan: String(l.plan ?? "") } : null;
  }
  return null;
}

/** 端末から推定した地域（billingRegion）。参考値で、サーバーはアクセス元の国を優先する。読めなければ null */
export function regionFromPayload(payload: unknown): Region | null {
  if (typeof payload !== "object" || payload === null) return null;
  const v = (payload as Record<string, unknown>).billingRegion;
  return v === "jp" || v === "intl" ? v : null;
}
