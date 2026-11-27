// 料金計算（純粋関数。画面・テストの両方から使う）。金額はすべて円の整数。
// 料金 = 基本単価 × 数量 × 納期係数。納期係数は 10 倍の整数で受け取り、最後に 1 回だけ四捨五入する（端数処理を一箇所に集める）

export type DeliveryFactor = { factorTenths: number };

export function applyDelivery(base: number, delivery: DeliveryFactor): number {
  return Math.round((base * delivery.factorTenths) / 10);
}

export type BowingQuote = { unitPrice: number; listUnitPrice: number; setDiscountPerPage: number; pages: number; base: number; total: number };

/** 運指・運弓。両方同時はセット単価（通常は運弓＋運指の合計） */
export function quoteBowing(type: "bowing" | "fingering" | "both", pages: number, prices: Record<"bowing" | "fingering" | "both", number>, delivery: DeliveryFactor): BowingQuote {
  const unitPrice = prices[type];
  const listUnitPrice = type === "both" ? prices.bowing + prices.fingering : unitPrice;
  const base = unitPrice * pages;
  return { unitPrice, listUnitPrice, setDiscountPerPage: listUnitPrice - unitPrice, pages, base, total: applyDelivery(base, delivery) };
}

export type RecordingLine = { id: string; unitPrice: number; tracks: number; outsourced: boolean; subtotal: number };
export type RecordingQuote = { lines: RecordingLine[]; tracks: number; base: number; total: number };

/** 録音。楽器ごとの小計 → 合計（基本料金）→ 納期係数（全楽器の合計に適用） */
export function quoteRecording(items: { id: string; unitPrice: number; outsourced: boolean }[], tracks: Record<string, number>, delivery: DeliveryFactor): RecordingQuote {
  const lines = items
    .map((i) => ({ ...i, tracks: tracks[i.id] ?? 0 }))
    .filter((l) => l.tracks > 0)
    .map((l) => ({ ...l, subtotal: l.unitPrice * l.tracks }));
  const base = lines.reduce((n, l) => n + l.subtotal, 0);
  return { lines, tracks: lines.reduce((n, l) => n + l.tracks, 0), base, total: applyDelivery(base, delivery) };
}

/** 数量の入力を範囲内の整数に丸める（不正な値は min に戻す） */
export function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
