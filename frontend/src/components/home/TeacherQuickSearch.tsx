"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { prefectures } from "@/data/prefectures";
import { pagePaths } from "@/data/site";
import { instrumentCategories, type InstrumentCategory, type LessonFormat } from "@/data/teachers";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildTeacherQuery } from "@/lib/teacherQuery";

// トップページの講師簡易検索（トップページ改修指示書 §4）。
// 詳しい条件（性別・対象・キーワード等）は講師検索ページで指定する。
export default function TeacherQuickSearch({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.homeTeacherSearch;
  const router = useRouter();

  const [category, setCategory] = useState<"all" | InstrumentCategory>("all");
  const [pref, setPref] = useState("all");
  const [format, setFormat] = useState<"any" | "in_person" | "online">("any");
  const [visiting, setVisiting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const formats: LessonFormat[] = [];
    if (format !== "any") formats.push(format);
    if (visiting) formats.push("visiting");
    const query = buildTeacherQuery({ category, pref, formats });
    router.push(`${localizedPath(locale, pagePaths.teachers)}${query}`);
  }

  const fieldClass = "w-full rounded-control border border-line bg-card p-[13px] text-ink";

  return (
    <div className="rounded-card border border-line bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="teacher-search-heading" className="text-xl font-bold sm:text-2xl">
            {t.heading}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.lead}</p>
        </div>
        <Link href={localizedPath(locale, pagePaths.teachers)} className="text-[13px] text-navy underline">
          {t.detailLink}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
        <div className="grid gap-[7px]">
          <label htmlFor="quick-category" className="text-[13px] font-semibold">
            {t.instrument}
          </label>
          <select
            id="quick-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | InstrumentCategory)}
            className={fieldClass}
          >
            <option value="all">{dict.teachers.categoryAll}</option>
            {instrumentCategories.map((c) => (
              <option key={c} value={c}>
                {dict.teachers.categories[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-[7px]">
          <label htmlFor="quick-pref" className="text-[13px] font-semibold">
            {t.region}
          </label>
          <select id="quick-pref" value={pref} onChange={(e) => setPref(e.target.value)} className={fieldClass}>
            <option value="all">{dict.teachers.prefectureAll}</option>
            {prefectures.map((p) => (
              <option key={p.code} value={p.code}>
                {p[locale]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-[7px]">
          <label htmlFor="quick-format" className="text-[13px] font-semibold">
            {t.format}
          </label>
          <select
            id="quick-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as "any" | "in_person" | "online")}
            className={fieldClass}
          >
            <option value="any">{t.formatAny}</option>
            <option value="in_person">{t.formatInPerson}</option>
            <option value="online">{t.formatOnline}</option>
          </select>
        </div>

        <label className="flex min-h-[50px] cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={visiting}
            onChange={(e) => setVisiting(e.target.checked)}
            className="h-5 w-5 accent-navy"
          />
          {t.visiting}
        </label>

        <button
          type="submit"
          className="min-h-[50px] rounded-button border border-navy bg-navy px-6 text-[14px] font-semibold text-white transition-[filter] hover:brightness-95 sm:col-span-2 lg:col-span-1"
        >
          {t.submit}
        </button>
      </form>

      <p className="mt-4 text-xs text-muted">{t.freeNote}</p>
    </div>
  );
}
