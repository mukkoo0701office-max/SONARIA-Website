"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/data/dictionaries/types";
import { currencyOf, currentPrices, formatMoney, SEED_PRICES, unitPrice, type PriceRow, type Region } from "@/lib/orders/priceEngine";
import { loadPriceRows } from "@/lib/orders/priceTable";
import { guessRegion, todayTokyo } from "@/lib/orders/region";

const items = ["fingering", "bowing", "both"] as const;

// 運指・運弓の料金（料金マスタ・地域で円／ドル）。静的書き出しの HTML は日本の料金で、表示後に地域と最新の料金へ切り替える
export default function BowingPrices({ t }: { t: Dictionary["library"]["bowing"] }) {
  const [rows, setRows] = useState<readonly PriceRow[]>(SEED_PRICES);
  const [region, setRegion] = useState<Region | null | undefined>(undefined);
  useEffect(() => {
    setRegion(guessRegion());
    loadPriceRows().then(setRows);
  }, []);
  const r: Region = region ?? "jp";
  const prices = currentPrices(rows, todayTokyo());
  return (
    <>
      <ul className="mt-2 grid gap-0.5 text-[13px]">
        {items.map((k) => {
          const amount = unitPrice(prices, "bowing", k, r) ?? unitPrice(currentPrices(SEED_PRICES, "9999-12-31"), "bowing", k, r);
          return amount == null ? null : <li key={k}>・{t.priceLines[k].replace("{price}", formatMoney(amount, currencyOf(r)))}</li>;
        })}
      </ul>
      {region !== undefined && <p className="mt-1 text-xs text-muted">{t.priceNote[region ?? "unknown"]}</p>}
    </>
  );
}
