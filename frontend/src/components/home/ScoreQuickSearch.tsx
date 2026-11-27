"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { instruments, type Formation, type Instrument } from "@/data/works";
import { localizedPath, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  workCount: number; // 掲載している作品数（0 のときは件数を出さない）
  composers: { id: string; name: string; href: string }[]; // 作品数の多い作曲家（ページ側で選ぶ）
  formations: readonly Formation[]; // 掲載作品がある編成だけ（ページ側でカタログから作る）
};

// トップページの楽譜簡易検索。条件は楽譜検索ページの URL クエリ（q / inst / fmt）にそのまま引き継ぐ
export default function ScoreQuickSearch({ locale, workCount, composers, formations }: Props) {
  const dict = getDictionary(locale);
  const t = dict.homeScoreSearch;
  const s = dict.scores;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [inst, setInst] = useState<"all" | Instrument>("all");
  const [fmt, setFmt] = useState<"all" | Formation>("all");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (inst !== "all") params.set("inst", inst);
    if (fmt !== "all") params.set("fmt", fmt);
    const query = params.toString();
    router.push(`${localizedPath(locale, pagePaths.scores)}${query ? `?${query}` : ""}`);
  }

  const fieldClass = "w-full rounded-control border border-muted bg-card p-[13px] text-ink";

  return (
    <div className="rounded-card border border-line bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="score-search-heading" className="text-xl font-bold sm:text-2xl">
            {t.heading}
          </h2>
          <p className="mt-1 text-sm text-muted">{workCount > 0 ? t.leadWithCount(workCount) : t.lead}</p>
        </div>
        <Link href={localizedPath(locale, pagePaths.scores)} className="text-[13px] text-navy underline">
          {t.detailLink}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <div className="grid gap-[7px] sm:col-span-2 lg:col-span-1">
          <label htmlFor="quick-score-q" className="text-[13px] font-semibold">
            {t.keyword}
          </label>
          <input id="quick-score-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.placeholder} className={fieldClass} />
        </div>
        <div className="grid gap-[7px]">
          <label htmlFor="quick-score-inst" className="text-[13px] font-semibold">
            {s.instrument}
          </label>
          <select id="quick-score-inst" value={inst} onChange={(e) => setInst(e.target.value as "all" | Instrument)} className={fieldClass}>
            <option value="all">{s.all}</option>
            {instruments.map((v) => (
              <option key={v} value={v}>
                {s.instrumentOptions[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-[7px]">
          <label htmlFor="quick-score-fmt" className="text-[13px] font-semibold">
            {s.formation}
          </label>
          <select id="quick-score-fmt" value={fmt} onChange={(e) => setFmt(e.target.value as "all" | Formation)} className={fieldClass}>
            <option value="all">{s.all}</option>
            {formations.map((v) => (
              <option key={v} value={v}>
                {s.formationOptions[v]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-button border border-navy bg-navy px-6 py-[13px] font-semibold text-white hover:brightness-95">
          {t.submit}
        </button>
      </form>

      {composers.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-semibold">{t.byComposer}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {composers.map((c) => (
              <li key={c.id}>
                <Link href={c.href} className="inline-block rounded-full border border-line bg-card px-3 py-1.5 text-[13px] hover:border-navy">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">{t.freeNote}</p>
    </div>
  );
}
