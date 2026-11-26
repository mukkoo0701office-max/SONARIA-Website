"use client";

import Script from "next/script";
import { useEffect } from "react";
import { adPlacements, type AdConfig, type AdPlacement } from "@/data/ads";
import type { Dictionary } from "@/data/dictionaries/types";
import type { AffiliateLink } from "@/data/scores/types";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  placement: AdPlacement;
  t: Dictionary["library"]["ad"];
  links?: AffiliateLink[]; // 作品ごとの商品リンク（あれば共通設定より優先）
};

// 汎用の広告・アフィリエイト枠（設定は data/ads.ts）。
// - 常に「PR」を表示し、リンクには rel="sponsored nofollow noopener" を付ける
// - 高さを先に確保してレイアウトのずれ（CLS）を防ぐ
// - 本番で未設定なら何も表示しない。プレビューでは枠の位置が分かるよう仮表示する
export default function AffiliateSlot({ placement, t, links }: Props) {
  const config: AdConfig = links && links.length > 0 ? { type: "links", links } : adPlacements[placement];
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW === "1";

  if (config.type === "none") {
    if (!isPreview) return null;
    return (
      <aside aria-label={t.label} className="my-8 rounded-card border border-dashed border-line p-4 text-center text-xs text-muted">
        <span className="mr-2 rounded-full border border-line px-2 py-0.5 font-semibold">{t.label}</span>
        {t.placeholder}
      </aside>
    );
  }

  return (
    <aside aria-label={t.label} className="my-8 rounded-card border border-line bg-card p-4">
      <p className="mb-2 text-xs font-semibold text-muted">{t.label}</p>
      {config.type === "links" && (
        <ul className="grid gap-2 text-sm">
          {config.links
            .filter((l) => l.url.startsWith("https://"))
            .map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="sponsored nofollow noopener noreferrer" className="text-navy underline">
                  {l.label}
                </a>
                {l.provider && <span className="ml-2 text-xs text-muted">{l.provider}</span>}
                {l.note && <span className="block text-xs text-muted">{l.note}</span>}
              </li>
            ))}
        </ul>
      )}
      {config.type === "html" && (
        // 提携先の貼り付けコードはサイト本体の DOM・Cookie に触れないよう、別オリジン扱いの iframe で動かす
        <iframe
          title={t.label}
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">${config.html}</body></html>`}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
          className="w-full border-0"
          style={{ height: config.height }}
        />
      )}
      {config.type === "adsense" && <AdSense client={config.client} slot={config.slot} height={config.height} />}
    </aside>
  );
}

function AdSense({ client, slot, height }: { client: string; slot: string; height: number }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 広告ブロッカーなどで読み込めない場合は何もしない
    }
  }, []);
  return (
    <>
      <Script src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`} strategy="afterInteractive" crossOrigin="anonymous" />
      <ins className="adsbygoogle block" style={{ minHeight: height }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </>
  );
}
