"use client";

import { useState } from "react";
import { amazonSearch } from "@/data/affiliate/amazonSearch";
import { getDictionary } from "@/data/dictionaries";
import { amazonKeyword, amazonSearchKinds, amazonSearchUrl, type AmazonSearchKind } from "@/lib/affiliate/amazonSearch";
import { jaOrEn, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  work: { composer: string; title: string; catalog?: string };
};

// 作品ページの「Amazon で関連楽譜を探す」（広告）。スコア・パート譜・ポケットスコア・解説書を切り替えて検索する。
// 検索結果は作品との一致を保証しないので、特定の商品を勧める書き方はしない。PDF のダウンロードボタンからは離して置く
// クライアント部品には関数を含む辞書を渡せないため、辞書はここで読む
export default function AmazonSearchWidget({ locale, work }: Props) {
  const lib = getDictionary(locale).library;
  const t = lib.ad;
  const [kind, setKind] = useState<AmazonSearchKind>("score");
  const keyword = amazonKeyword(work, kind, jaOrEn(locale));
  const s = lib.amazonSearch;
  return (
    <aside aria-labelledby="amazon-search" className="my-8 overflow-hidden rounded-card border border-line bg-card">
      <div className="relative bg-navy px-5 py-5 text-white sm:px-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 select-none text-[110px] leading-none text-gold/25">
          ♫
        </span>
        <span className="relative inline-block rounded-full border border-white/50 px-2 py-0.5 text-xs font-semibold">{t.label}</span>
        <h2 id="amazon-search" className="relative mt-2 text-lg font-bold">
          {s.heading}
        </h2>
        <p className="relative mt-1 text-[13px] text-white/85">{s.lead}</p>
      </div>
      <div className="grid gap-3 p-5 sm:p-6">
        <div role="group" aria-label={s.kindsLabel} className="flex flex-wrap gap-2">
          {amazonSearchKinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? "rounded-full border border-navy bg-navy px-[13px] py-[7px] text-[13px] text-white"
                  : "rounded-full border border-muted bg-card px-[13px] py-[7px] text-[13px] text-ink hover:bg-subtle"
              }
            >
              {s.kinds[k]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {s.keywordLabel}: <span className="text-ink">{keyword}</span>
        </p>
        <a
          href={amazonSearchUrl(keyword, amazonSearch.tag)}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-navy bg-navy px-5 py-3 text-[15px] font-semibold text-white hover:brightness-110"
        >
          {s.cta} <span aria-hidden="true" className="ml-1">↗</span>
          <span className="sr-only">{s.newWindow}</span>
        </a>
        <p className="text-xs leading-relaxed text-muted">{t.amazonDisclosure}</p>
      </div>
    </aside>
  );
}
