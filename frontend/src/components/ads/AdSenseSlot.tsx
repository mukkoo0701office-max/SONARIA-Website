"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { adsenseConfig, adsenseUnitReady, type AdSenseUnitId } from "@/data/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  unit: AdSenseUnitId;
  t: { label: string; previewNote: string }; // 関数を含まない文言だけを受け取る（クライアント部品のため）
};

// Google AdSense の広告枠（1 ユニット）。設定は data/ads.ts の adsenseConfig。
// - client・slot が未設定なら広告コードを読み込まない。本番では何も表示しない（ダミー広告を出さない）
// - プレビュー（NEXT_PUBLIC_PREVIEW=1）と開発時（next dev）だけ、枠の位置が分かる仮表示を出す
// - 表記は「広告」/「Advertisement」だけ（AdSense のポリシーで認められた表記）
// - 高さを先に確保してレイアウトのずれを抑える。広告ブロッカーで読み込めなくても、枠の高さが残るだけで本文は崩れない
// - 広告スクリプトはこの部品があるページでだけ、ページの読み込みが終わってから読み込む（ダウンロード操作を妨げない）
export default function AdSenseSlot({ unit, t }: Props) {
  const ready = adsenseUnitReady(unit);
  const preview = process.env.NEXT_PUBLIC_PREVIEW === "1" || process.env.NODE_ENV === "development";
  const pushed = useRef(false);

  useEffect(() => {
    if (!ready || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 広告ブロッカーなどで読み込めない場合は何もしない（ページの操作には影響させない）
    }
  }, [ready]);

  if (!ready) {
    if (!preview) return null;
    return (
      <aside aria-label={t.label} data-ad-slot-preview={unit} className="my-10 border-y border-line py-4">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted">{t.label}</p>
        <div className="grid min-h-[250px] place-items-center rounded-control border border-dashed border-line bg-paper px-4 text-center text-[12px] leading-relaxed text-muted">
          {t.previewNote}
        </div>
      </aside>
    );
  }

  const u = adsenseConfig.units[unit];
  return (
    <aside aria-label={t.label} className="my-10 border-y border-line py-4">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted">{t.label}</p>
      <Script
        id="adsbygoogle-js"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseConfig.client}`}
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block min-h-[250px]"
        style={{ display: "block" }}
        data-ad-client={adsenseConfig.client}
        data-ad-slot={u.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
