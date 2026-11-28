// 料金マスタの取得（public.price_items。公開キーで読める）。
// 取得できない（未接続・通信エラー）ときは初期の料金（SEED_PRICES）で表示する。
// 画面の金額は表示用で、受付時にサーバーが料金マスタで計算し直す（画面の値は使わない）
import { SEED_PRICES, type PriceRow } from "./priceEngine";
import { supabaseRest } from "./submit";

let cache: Promise<readonly PriceRow[]> | null = null;

export function loadPriceRows(): Promise<readonly PriceRow[]> {
  if (cache) return cache;
  const rest = supabaseRest();
  if (!rest) return (cache = Promise.resolve(SEED_PRICES));
  cache = fetch(`${rest.url}/price_items?select=service,item,mode,jpy,usd_cents,effective_from,active`, {
    headers: { apikey: rest.key, Authorization: `Bearer ${rest.key}` },
    signal: AbortSignal.timeout(5000),
  })
    .then(async (r) => {
      if (!r.ok) return SEED_PRICES;
      const rows = (await r.json()) as PriceRow[];
      return Array.isArray(rows) && rows.length > 0 ? rows : SEED_PRICES;
    })
    .catch(() => SEED_PRICES);
  return cache;
}
