"use client";

import { useEffect, useMemo, useState } from "react";
import WorkCard from "@/components/scores/WorkCard";
import Chip from "@/components/ui/Chip";
import Pagination from "@/components/ui/Pagination";
import SelectField from "@/components/ui/SelectField";
import { getDictionary } from "@/data/dictionaries";
import { hasPublishedWorks, publishedWorks, toSummary } from "@/data/scores/catalog";
import { ensembles, eras, musicalForms, works as demoWorks, type Ensemble, type Era, type MusicalForm } from "@/data/works";
import type { Locale } from "@/lib/i18n";

// 承認済みプロトタイプ（prototypes/score-search-ui-v1.html）の検索 UI を部品化したもの。
// 振る舞いの基準: docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md「Search page reference interaction contract」

const PER_PAGE = 5;

// 権利確認済みの作品が 1 件でもあればカタログを使う。まだ無いあいだは説明用のデモデータ（画面に明記）
const works = hasPublishedWorks ? publishedWorks.map(toSummary) : demoWorks;
const isDemoData = !hasPublishedWorks;

type PlayersFilter = "all" | "1" | "2" | "3" | "4" | "5plus";
type SortKey = "title" | "composer" | "pdfCount";

type Filters = {
  q: string;
  players: PlayersFilter;
  ensemble: "all" | Ensemble;
  form: "all" | MusicalForm;
  era: "all" | Era;
  sort: SortKey;
  page: number;
};

const initialFilters: Filters = { q: "", players: "all", ensemble: "all", form: "all", era: "all", sort: "title", page: 1 };

const playersValues: readonly PlayersFilter[] = ["all", "1", "2", "3", "4", "5plus"];
const sortValues: readonly SortKey[] = ["title", "composer", "pdfCount"];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// URL のクエリから検索条件を復元する（共有・戻る操作のため）。不正な値は初期値に戻す
function filtersFromSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    players: pick<PlayersFilter>(params.get("players"), playersValues, "all"),
    ensemble: pick<"all" | Ensemble>(params.get("ensemble"), ["all", ...ensembles], "all"),
    form: pick<"all" | MusicalForm>(params.get("form"), ["all", ...musicalForms], "all"),
    era: pick<"all" | Era>(params.get("era"), ["all", ...eras], "all"),
    sort: pick<SortKey>(params.get("sort"), sortValues, "title"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// 初期値と同じ項目はクエリに書かない（URL を短く保つ）
function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(initialFilters) as (keyof Filters)[]) {
    if (filters[key] !== initialFilters[key]) params.set(key, String(filters[key]));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function ScoreSearch({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).scores;
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<ReadonlySet<number>>(new Set());

  // 静的書き出しのため、クエリはマウント後にブラウザから読む
  useEffect(() => {
    setFilters(filtersFromSearch(window.location.search));
    setReady(true);
    const onPopState = () => setFilters(filtersFromSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 条件が変わったら URL を更新する（履歴は増やさない）
  useEffect(() => {
    if (!ready) return;
    const next = `${window.location.pathname}${filtersToSearch(filters)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [filters, ready]);

  const results = useMemo(() => {
    const q = filters.q.trim().toLocaleLowerCase();
    return works
      .filter((w) => {
        const text = [w.title.ja, w.title.en, w.composer.ja, w.composer.en].join(" ").toLocaleLowerCase();
        if (q && !text.includes(q)) return false;
        if (filters.players !== "all") {
          if (filters.players === "5plus" ? w.players < 5 : w.players !== Number(filters.players)) return false;
        }
        if (filters.ensemble !== "all" && w.ensemble !== filters.ensemble) return false;
        if (filters.form !== "all" && w.form !== filters.form) return false;
        if (filters.era !== "all" && w.era !== filters.era) return false;
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === "pdfCount") return b.pdfCount - a.pdfCount;
        if (filters.sort === "composer") return a.composer.en.localeCompare(b.composer.en);
        return a.title[locale].localeCompare(b.title[locale], locale);
      });
  }, [filters, locale]);

  const totalPages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const page = Math.min(filters.page, totalPages);
  const pageItems = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // 条件を変えたら 1 ページ目に戻す
  function update(patch: Partial<Omit<Filters, "page">>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <section className="my-6">
        <h1 className="mb-1.5 text-2xl font-bold">{t.headline}</h1>
        <p className="text-xs text-muted">{t.subtitle}</p>
      </section>

      <div className="my-4 grid gap-[7px]">
        <input
          type="search"
          autoComplete="off"
          aria-label={t.searchLabel}
          placeholder={t.placeholder}
          value={filters.q}
          onChange={(event) => update({ q: event.target.value })}
          className="w-full rounded-control border border-line bg-card p-[13px] text-ink"
        />
      </div>

      <fieldset className="my-4 grid gap-[7px]">
        <legend className="mb-[7px] text-[13px] font-semibold">{t.players}</legend>
        <div className="flex flex-wrap gap-[7px]">
          {playersValues.map((value) => (
            <Chip key={value} pressed={filters.players === value} onClick={() => update({ players: value })}>
              {t.playersOptions[value]}
            </Chip>
          ))}
        </div>
      </fieldset>

      {/* スマホは1カラム、幅に余裕があれば2カラム */}
      <div className="grid grid-cols-1 gap-x-3 min-[421px]:grid-cols-2">
        <SelectField
          id="ensemble"
          label={t.ensemble}
          value={filters.ensemble}
          options={(["all", ...ensembles] as const).map((v) => ({ value: v, label: t.ensembleOptions[v] }))}
          onChange={(v) => update({ ensemble: v })}
        />
        <SelectField
          id="form"
          label={t.form}
          value={filters.form}
          options={(["all", ...musicalForms] as const).map((v) => ({ value: v, label: t.formOptions[v] }))}
          onChange={(v) => update({ form: v })}
        />
      </div>

      <details>
        <summary className="cursor-pointer py-3 text-[13px] font-semibold">{t.advanced}</summary>
        <SelectField
          id="era"
          label={t.era}
          value={filters.era}
          options={(["all", ...eras] as const).map((v) => ({ value: v, label: t.eraOptions[v] }))}
          onChange={(v) => update({ era: v })}
        />
      </details>

      <div className="mb-3.5 mt-6 flex items-center justify-between gap-3">
        <div aria-live="polite">
          <span className="text-[23px] font-bold">{results.length}</span> <span className="text-xs text-muted">{t.works}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFilters(initialFilters);
            setOpenId(null);
          }}
          className="text-navy underline"
        >
          {t.reset}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="sort" className="text-xs text-muted">
          {t.sort}
        </label>
        <select
          id="sort"
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value as SortKey })}
          className="w-[180px] rounded-control border border-line bg-card p-[13px] text-ink"
        >
          {sortValues.map((value) => (
            <option key={value} value={value}>
              {t.sortOptions[value]}
            </option>
          ))}
        </select>
      </div>

      <section aria-label={t.resultsLabel}>
        {pageItems.map((work) => (
          <WorkCard
            key={work.id}
            work={work}
            locale={locale}
            t={t}
            open={openId === work.id}
            favorite={favorites.has(work.id)}
            onToggleOpen={() => setOpenId((prev) => (prev === work.id ? null : work.id))}
            onToggleFavorite={() => toggleFavorite(work.id)}
          />
        ))}
        {results.length === 0 && <p className="my-6 text-muted">{t.empty}</p>}
      </section>

      <Pagination
        page={page}
        totalPages={totalPages}
        prevLabel={t.pagePrev}
        nextLabel={t.pageNext}
        onChange={(next) => {
          setFilters((prev) => ({ ...prev, page: next }));
          setOpenId(null);
        }}
      />

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-[15px] text-xs text-muted">
        <span>{isDemoData ? t.demo : null}</span>
        <span>
          {t.saved}: {favorites.size}
        </span>
      </div>
    </div>
  );
}
