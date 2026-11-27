"use client";

import { useMemo, useState } from "react";

export type ScoreAffiliateProps = {
  composer: string;
  workTitle?: string;
  instrumentation?: string;
  locale?: "ja" | "en";
  /** Verified Amazon Associates URL generated using an authorized method. */
  affiliateUrl?: string;
};

const labels = {
  ja: { ad: "広告・PR", title: "関連する楽譜・書籍を探す", desc: "スコア・パート譜・研究書をAmazonで検索", search: "Amazonで探す", composer: "作曲家", kind: "種類", score: "スコア", parts: "パート譜", books: "研究書", disclosure: "SONARIAはAmazonのアソシエイトとして適格販売により収入を得ています。" },
  en: { ad: "Advertisement", title: "Find related scores and books", desc: "Search scores, parts and music books on Amazon", search: "Search Amazon", composer: "Composer", kind: "Category", score: "Scores", parts: "Parts", books: "Books", disclosure: "As an Amazon Associate, SONARIA earns from qualifying purchases." },
};

export function ScoreAffiliateWidget({ composer, workTitle = "", instrumentation = "", locale = "ja", affiliateUrl }: ScoreAffiliateProps) {
  const t = labels[locale];
  const [kind, setKind] = useState("score");
  const keyword = useMemo(() => [composer, workTitle, instrumentation, kind === "score" ? (locale === "ja" ? "楽譜 スコア" : "sheet music score") : kind === "parts" ? (locale === "ja" ? "パート譜" : "sheet music parts") : (locale === "ja" ? "研究書" : "music analysis book")].filter(Boolean).join(" "), [composer, workTitle, instrumentation, kind, locale]);
  // Affiliate URLs must be issued and validated through an authorized Amazon Associates method.
  // Without a verified URL, use a normal non-affiliate Amazon search link (no tag).
  const url = affiliateUrl && kind === "score" ? affiliateUrl : `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}`;
  return (
    <aside aria-label={t.title} className="my-8 overflow-hidden rounded-2xl border border-[#E5E0D6] bg-white text-[#182B45] shadow-sm">
      <div className="relative min-h-32 overflow-hidden bg-[#182B45] px-5 py-6 text-white sm:px-7">
        <span className="absolute right-4 top-3 rounded-full border border-white/40 px-2 py-1 text-xs">{t.ad}</span>
        <div aria-hidden="true" className="absolute -right-5 -top-12 rotate-12 text-[150px] leading-none text-[#B79656]/20">♫</div>
        <div className="relative max-w-lg">
          <div className="mb-2 text-xs font-medium tracking-[0.2em] text-[#D6BF91]">SONARIA MUSIC LIBRARY</div>
          <h2 className="text-lg font-semibold sm:text-xl">{t.title}</h2>
          <p className="mt-2 text-sm text-white/80">{t.desc}</p>
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm text-[#667085]">{t.composer}: <strong className="text-[#182B45]">{composer}</strong>{workTitle ? ` · ${workTitle}` : ""}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.kind}>
          {([["score", t.score], ["parts", t.parts], ["books", t.books]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`rounded-full border px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#182B45] ${kind === value ? "border-[#182B45] bg-[#182B45] text-white" : "border-[#667085] bg-white text-[#182B45] hover:bg-[#FAF9F6]"}`}>{label}</button>
          ))}
        </div>
        <a href={url} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#182B45] px-5 py-3 text-center font-semibold text-white hover:bg-[#273f5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#182B45]">{t.search} ↗</a>
        <p className="text-xs leading-relaxed text-[#667085]">{t.disclosure}</p>
      </div>
    </aside>
  );
}

export function ScoreAffiliateBanner({ composer, workTitle = "", locale = "ja", affiliateUrl }: Omit<ScoreAffiliateProps, "instrumentation">) {
  const t = labels[locale];
  const url = affiliateUrl || `https://www.amazon.co.jp/s?k=${encodeURIComponent([composer, workTitle, locale === "ja" ? "楽譜 スコア" : "sheet music score"].filter(Boolean).join(" "))}`;
  return <aside aria-label={t.title} className="my-6 overflow-hidden rounded-2xl border border-[#E5E0D6] bg-[#182B45] text-white">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><span className="text-xs text-[#D6BF91]">{t.ad} · SONARIA</span><h2 className="mt-1 text-lg font-semibold">{t.title}</h2><p className="mt-1 text-sm text-white/80">{composer}{workTitle ? ` · ${workTitle}` : ""}</p></div>
      <a href={url} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#D6BF91] px-5 py-3 font-semibold text-[#182B45] hover:bg-[#e7d4ae] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t.search} ↗</a>
    </div>
    <p className="px-5 pb-4 text-xs text-white/70 sm:px-6">{t.disclosure}</p>
  </aside>;
}
