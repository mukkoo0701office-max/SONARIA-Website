"use client";

import TeacherRegisterCta from "@/components/teachers/TeacherRegisterCta";
import { useEffect, useMemo, useState } from "react";
import TeacherCard from "@/components/teachers/TeacherCard";
import Chip from "@/components/ui/Chip";
import Pagination from "@/components/ui/Pagination";
import SelectField from "@/components/ui/SelectField";
import { getDictionary } from "@/data/dictionaries";
import { findPrefecture, prefectures } from "@/data/prefectures";
import { pagePaths } from "@/data/site";
import {
  audiences,
  instrumentCategories,
  instrumentCategoryOf,
  lessonFormats,
  showsDemoTeachers,
  teachers,
  type Audience,
  type LessonFormat,
} from "@/data/teachers";
import { localizedPath, type Locale } from "@/lib/i18n";
import { normalizeForSearch } from "@/lib/normalize";
import {
  buildTeacherQuery,
  initialTeacherFilters,
  teacherFiltersFromSearch,
  type GenderFilter,
  type TeacherFilters,
  type TeacherSort,
} from "@/lib/teacherQuery";

// 講師検索。仕様: docs/SONARIA_TEACHER_DIRECTORY_UI_SPEC_v1.0.md（承認済み B案）
// 操作感は楽譜検索と同じ部品をそろえる。料金の項目・絞り込みは作らない。
const PER_PAGE = 5;

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function TeacherSearch({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.teachers;
  const [filters, setFilters] = useState<TeacherFilters>(initialTeacherFilters);
  const [ready, setReady] = useState(false);

  // 静的書き出しのため、クエリはマウント後にブラウザから読む（トップの簡易検索からの条件もここで受け取る）
  useEffect(() => {
    setFilters(teacherFiltersFromSearch(window.location.search));
    setReady(true);
    const onPopState = () => setFilters(teacherFiltersFromSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = `${window.location.pathname}${buildTeacherQuery(filters)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [filters, ready]);

  const results = useMemo(() => {
    const q = normalizeForSearch(filters.q.trim());
    return teachers
      .filter((teacher) => {
        if (q) {
          const pref = findPrefecture(teacher.prefectureCode);
          const haystack = normalizeForSearch(
            [
              teacher.displayName.ja,
              teacher.displayName.en,
              teacher.nameKana,
              teacher.nameRomaji,
              ...teacher.instruments.flatMap((i) => [dict.teachers.instruments[i], i]),
              pref?.ja ?? "",
              pref?.en ?? "",
              teacher.station?.ja ?? "",
              teacher.station?.en ?? "",
            ].join(" "),
          );
          if (!haystack.includes(q)) return false;
        }
        if (filters.category !== "all" && !teacher.instruments.some((i) => instrumentCategoryOf[i] === filters.category)) {
          return false;
        }
        // オンライン専用の講師は地域を問わず表示する（仕様 §3-3）
        const onlineOnly = teacher.formats.length === 1 && teacher.formats[0] === "online";
        if (filters.pref !== "all" && teacher.prefectureCode !== filters.pref && !onlineOnly) return false;
        if (!filters.formats.every((f) => teacher.formats.includes(f))) return false;
        // 「指定なし」は全員。性別を公開していない講師は性別の絞り込みに含めない（仕様 §9）
        if (filters.gender !== "any" && teacher.gender !== filters.gender) return false;
        if (!filters.audiences.every((a) => teacher.audiences.includes(a))) return false;
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === "area") {
          return a.prefectureCode.localeCompare(b.prefectureCode) || a.nameRomaji.localeCompare(b.nameRomaji);
        }
        return locale === "ja" ? a.nameKana.localeCompare(b.nameKana, "ja") : a.nameRomaji.localeCompare(b.nameRomaji);
      });
  }, [filters, locale, dict]);

  const totalPages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const page = Math.min(filters.page, totalPages);
  const pageItems = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function update(patch: Partial<Omit<TeacherFilters, "page">>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  const profileBase = localizedPath(locale, `${pagePaths.teachers}profile/`);

  return (
    <div>
      <section className="my-6">
        <h1 className="mb-1.5 text-2xl font-bold">{t.headline}</h1>
        <p className="text-xs text-muted">{t.lead}</p>
      </section>

      {/* 講師登録の案内は検索のすぐ近くに置く（PR #24 §2） */}
      <div className="mb-4">
        <TeacherRegisterCta locale={locale} compact />
      </div>

      {showsDemoTeachers && (
        <p role="note" className="mb-4 rounded-button border border-dashed border-gold bg-card p-3 text-[13px] leading-relaxed">
          {t.demoNotice}
        </p>
      )}

      <div className="my-4 grid gap-[7px]">
        <label htmlFor="teacher-q" className="text-[13px] font-semibold">
          {t.keyword}
        </label>
        <input
          id="teacher-q"
          type="search"
          autoComplete="off"
          placeholder={t.keywordPlaceholder}
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          className="w-full rounded-control border border-line bg-card p-[13px] text-ink"
        />
      </div>

      <fieldset className="my-4">
        <legend className="mb-[7px] text-[13px] font-semibold">{t.category}</legend>
        <div className="flex flex-wrap gap-[7px]">
          <Chip pressed={filters.category === "all"} onClick={() => update({ category: "all" })}>
            {t.categoryAll}
          </Chip>
          {instrumentCategories.map((c) => (
            <Chip key={c} pressed={filters.category === c} onClick={() => update({ category: c })}>
              {t.categories[c]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-x-3 min-[421px]:grid-cols-2">
        <SelectField
          id="teacher-pref"
          label={t.prefecture}
          value={filters.pref}
          options={[{ value: "all", label: t.prefectureAll }, ...prefectures.map((p) => ({ value: p.code, label: p[locale] }))]}
          onChange={(v) => update({ pref: v })}
        />
        <fieldset className="my-4">
          <legend className="mb-[7px] text-[13px] font-semibold">{t.format}</legend>
          <div className="flex flex-wrap gap-[7px]">
            {lessonFormats.map((f: LessonFormat) => (
              <Chip key={f} pressed={filters.formats.includes(f)} onClick={() => update({ formats: toggle(filters.formats, f) })}>
                {t.formats[f]}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="my-4">
        <legend className="mb-[7px] text-[13px] font-semibold">{t.gender}</legend>
        <div className="flex flex-wrap gap-[7px]">
          {(["any", "female", "male"] as const).map((g: GenderFilter) => (
            <Chip key={g} pressed={filters.gender === g} onClick={() => update({ gender: g })}>
              {t.genderOptions[g]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <details>
        <summary className="cursor-pointer py-3 text-[13px] font-semibold">{t.advanced}</summary>
        <fieldset className="my-2">
          <legend className="mb-[7px] text-[13px] font-semibold">{t.audience}</legend>
          <div className="flex flex-wrap gap-[7px]">
            {audiences.map((a: Audience) => (
              <Chip key={a} pressed={filters.audiences.includes(a)} onClick={() => update({ audiences: toggle(filters.audiences, a) })}>
                {t.audiences[a]}
              </Chip>
            ))}
          </div>
        </fieldset>
      </details>

      <div className="mb-3.5 mt-6 flex items-center justify-between gap-3">
        <div aria-live="polite">
          <span className="text-[23px] font-bold">{results.length}</span> <span className="text-xs text-muted">{t.count}</span>
        </div>
        <button type="button" onClick={() => setFilters(initialTeacherFilters)} className="text-navy underline">
          {t.reset}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="teacher-sort" className="text-xs text-muted">
          {t.sort}
        </label>
        <select
          id="teacher-sort"
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as TeacherSort })}
          className="w-[180px] rounded-control border border-line bg-card p-[13px] text-ink"
        >
          <option value="name">{t.sortOptions.name}</option>
          <option value="area">{t.sortOptions.area}</option>
        </select>
      </div>

      <section aria-label={t.resultsLabel}>
        {pageItems.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            teacher={teacher}
            locale={locale}
            t={t}
            profileHref={`${profileBase}?id=${encodeURIComponent(teacher.id)}`}
          />
        ))}
        {teachers.length === 0 ? (
          <p className="my-6 rounded-card border border-line bg-card p-[17px] text-[13px] leading-relaxed">{t.noneYet}</p>
        ) : (
          results.length === 0 && <p className="my-6 text-muted">{t.empty}</p>
        )}
      </section>

      <Pagination
        page={page}
        totalPages={totalPages}
        prevLabel={t.pagePrev}
        nextLabel={t.pageNext}
        onChange={(next) => setFilters((prev) => ({ ...prev, page: next }))}
      />

      <ul className="mt-8 rounded-card border border-line bg-card p-[17px] text-[13px] leading-relaxed">
        {t.rules.map((rule) => (
          <li key={rule} className="ml-4 list-disc">
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
