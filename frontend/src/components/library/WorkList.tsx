import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { catalogLabel, composerOf, workLocales } from "@/data/scores/catalog";
import type { Work } from "@/data/scores/types";
import { tr, localizedPath, type Locale } from "@/lib/i18n";

/** 作品ページの URL。英語ページが無い作品は日本語ページへ（存在しない URL を作らない） */
export function workHref(w: Work, locale: Locale): string {
  return localizedPath(workLocales(w).includes(locale) ? locale : "ja", `/scores/${w.id}/`);
}

// 作品の一覧（作曲家・カテゴリ・関連楽譜・新着で共通）。リンク先は実在する作品ページだけ
export default function WorkList({ works, locale, showComposer = true }: { works: Work[]; locale: Locale; showComposer?: boolean }) {
  const t = getDictionary(locale).library;
  return (
    <ul className="grid gap-2.5">
      {works.map((w) => {
        const c = composerOf(w);
        const files = w.editions.reduce((n, e) => n + e.assets.length, 0);
        const jaOnly = locale !== "ja" && !workLocales(w).includes(locale);
        return (
          <li key={w.id}>
            <Link href={workHref(w, locale)} className="block rounded-card border border-line bg-card p-[13px] hover:border-navy">
              <span className="block text-[15px] font-bold leading-snug">{tr(w.title, locale)}</span>
              <span className="mt-1 block text-xs text-muted">
                {showComposer && <>{tr(c.short ?? c.name, locale)} ・ </>}
                {t.scoring[w.scoring]}
                {catalogLabel(w) && <> ・ {catalogLabel(w)}</>} ・ PDF {files}
                {jaOnly && <> ・ {t.onlyJapanese}</>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
