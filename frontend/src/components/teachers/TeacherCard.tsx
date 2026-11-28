import Link from "next/link";
import Tag from "@/components/ui/Tag";
import type { Dictionary } from "@/data/dictionaries/types";
import { findPrefecture } from "@/data/prefectures";
import type { Teacher } from "@/data/teachers";
import { tr, type Locale } from "@/lib/i18n";

type Props = {
  teacher: Teacher;
  locale: Locale;
  t: Dictionary["teachers"];
  profileHref: string;
};

// 講師の検索結果カード。公開項目だけを表示し、料金・評価・順位は出さない（仕様 §5）
export default function TeacherCard({ teacher, locale, t, profileHref }: Props) {
  const pref = findPrefecture(teacher.prefectureCode);

  return (
    <article className="my-3 rounded-card border border-line bg-card p-[17px]">
      <div className="flex items-start gap-3">
        {/* 写真は任意。未登録のあいだは汎用アイコン */}
        <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-subtle text-muted" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold leading-snug">{tr(teacher.displayName, locale)}</h2>
            {teacher.isDemo && (
              <span className="rounded-tag border border-line px-1.5 py-0.5 text-[10px] text-muted">{t.demoBadge}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {pref ? tr(pref, locale) : ""}
            {teacher.station ? ` · ${t.nearestStation(tr(teacher.station, locale))}` : ""}
          </p>
          {teacher.travel && <p className="mt-0.5 text-xs text-muted">{t.travel(teacher.travel.minutes)}</p>}
        </div>
      </div>

      <div className="my-3 flex flex-wrap items-center gap-1.5">
        {teacher.instruments.map((inst) => (
          <Tag key={inst}>{t.instruments[inst]}</Tag>
        ))}
        {teacher.formats.map((f) => (
          <Tag key={f}>{t.formats[f]}</Tag>
        ))}
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-muted">{tr(teacher.intro, locale)}</p>

      {/* 承認済み B案: まず SONARIA 内の簡易プロフィールへ */}
      <Link
        href={profileHref}
        className="block w-full rounded-button border border-navy bg-navy p-[11px] text-center text-[13px] text-white transition-[filter] hover:brightness-95"
      >
        {t.viewProfile}
      </Link>
    </article>
  );
}
