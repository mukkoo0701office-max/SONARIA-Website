"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { findPublishedWork, type CatalogWork } from "@/data/scores/catalog";
import { localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

// 作品詳細（/scores/work/?id=...）。権利確認済み（approved）の版・ファイルだけを表示する。
// PDF は利用者がリンクを押したときだけ読み込む（ページ表示時にプレビューを読み込まない）。
export default function WorkDetail({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.scores.work;
  const s = dict.scores;
  const [work, setWork] = useState<CatalogWork | null | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    setWork(findPublishedWork(id) ?? null);
  }, []);

  const back = localizedPath(locale, "/scores/");
  if (work === undefined) return <p className="my-10 text-sm text-muted" aria-busy="true" />;
  if (work === null) {
    return (
      <div className="my-10">
        <p className="text-sm">{t.notFound}</p>
        <Link href={back} className="mt-4 inline-block text-navy underline">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <article className="my-6">
      <Link href={back} className="text-[13px] text-navy underline">
        {t.back}
      </Link>
      <h1 className="mt-4 text-2xl font-bold leading-snug">{work.title[locale]}</h1>
      <p className="mt-1 text-sm text-muted">{work.composer[locale]}</p>

      <dl className="mt-5 grid gap-3 rounded-card border border-line bg-card p-[17px] text-[13px]">
        {work.opus && (
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 text-muted">{t.opus}</dt>
            <dd>{work.opus}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-muted">{t.instrumentation}</dt>
          <dd>
            {s.ensembleOptions[work.ensemble]} ・ {work.players >= 5 ? s.playersOptions["5plus"] : s.playersCount(work.players)} ・ {s.formOptions[work.form]} ・{" "}
            {s.eraOptions[work.era]}
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 text-lg font-bold">{t.editions}</h2>
      <p className="mt-1 text-xs text-muted">{t.fileNote}</p>
      {work.editions.map((ed) => (
        <section key={ed.id} className="mt-4 rounded-card border border-line bg-card p-[17px]">
          <h3 className="text-base font-bold">{ed.label[locale]}</h3>
          <p className="mt-1 text-xs text-muted">
            {ed.source.type === "imslp" ? t.source.imslp : ed.source.type === "own" ? t.source.own : t.source.other} ・ {t.rightsApproved}
          </p>
          <ul className="mt-3 grid gap-2">
            {ed.assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-button border border-line px-3 py-2.5 text-[13px]">
                <span>
                  {a.label[locale]}
                  <span className="ml-2 text-xs text-muted">
                    {t.pages(a.pages)} ・ {(a.bytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                <a
                  href={withBasePath(a.file)}
                  download
                  className="rounded-button border border-navy bg-navy px-3 py-2 text-[12px] font-semibold text-white hover:brightness-95"
                >
                  {t.download}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
