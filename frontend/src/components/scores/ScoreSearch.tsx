"use client";

import { useEffect, useMemo, useState } from "react";
import WorkCard from "@/components/scores/WorkCard";
import Chip from "@/components/ui/Chip";
import Pagination from "@/components/ui/Pagination";
import { getDictionary } from "@/data/dictionaries";
import { eras, formations, genres, instruments, type WorkSummary } from "@/data/works";
import { countBy, filtersFromSearch, filtersToSearch, initialFilters, matchesFilters, playersKey, sheetKeys, sortValues, type FacetKey, type ScoreFilters, type SortKey } from "@/lib/scores/filters";
import { playerCounts, sheetKinds } from "@/lib/scores/sheetType";
import { tr, type Locale } from "@/lib/i18n";

// 承認済みプロトタイプ（prototypes/score-search-ui-v1.html）の検索 UI を部品化したもの。
// 振る舞いの基準: docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md「Search page reference interaction contract」
// 2026-11-27 改訂（運営者の要望）: 絞り込みを「楽器」「編成」「種類」「作曲家」「時代」に変更し、
// 各選択肢に件数を表示する（0 件になる選択肢は出さない）。チップの見た目・配色は基準のまま。

const PER_PAGE = 5;

// 絞り込みの条件・判定は lib/scores/filters.ts（トップページの簡易検索と共通）
type Filters = ScoreFilters;

// works・isDemoData はページ（サーバー側）から受け取る。カタログ全体をブラウザに読み込ませないため
export default function ScoreSearch({ locale, works, isDemoData }: { locale: Locale; works: readonly WorkSummary[]; isDemoData: boolean }) {
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

  const results = useMemo(
    () =>
      works
        .filter((w) => matchesFilters(w, filters))
        .sort((a, b) => {
          if (filters.sort === "pdfCount") return b.pdfCount - a.pdfCount;
          if (filters.sort === "composer") return tr(a.composer, locale).localeCompare(tr(b.composer, locale), locale) || tr(a.title, locale).localeCompare(tr(b.title, locale), locale);
          return tr(a.title, locale).localeCompare(tr(b.title, locale), locale);
        }),
    [filters, locale, works],
  );

  const counts = useMemo(
    () => ({
      players: countBy(works, filters, "players", playersKey),
      sheet: countBy(works, filters, "sheet", sheetKeys),
      inst: countBy(works, filters, "inst", (w) => w.instruments),
      fmt: countBy(works, filters, "fmt", (w) => [w.formation]),
      genre: countBy(works, filters, "genre", (w) => [w.genre]),
      composer: countBy(works, filters, "composer", (w) => [w.composerId]),
      era: countBy(works, filters, "era", (w) => [w.era]),
    }),
    [filters, works],
  );

  // 作曲家の選択肢（作品数の多い順。表示名は作品データから）
  const composerOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const w of works) names.set(w.composerId, tr(w.composer, locale));
    return [...names.entries()]
      .map(([id, name]) => ({ id, name, n: counts.composer.get(id) ?? 0 }))
      .filter((c) => c.n > 0 || c.id === filters.composer)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, locale));
  }, [works, counts.composer, filters.composer, locale]);

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

  // 選択中の条件（外すボタン付きで一覧にする）
  const active: { key: FacetKey; label: string }[] = [];
  if (filters.players !== "all") active.push({ key: "players", label: `${t.players}: ${t.playersOptions[filters.players]}` });
  if (filters.inst !== "all") active.push({ key: "inst", label: t.instrumentOptions[filters.inst] });
  if (filters.fmt !== "all") active.push({ key: "fmt", label: t.formationOptions[filters.fmt] });
  if (filters.genre !== "all") active.push({ key: "genre", label: t.genreOptions[filters.genre] });
  if (filters.composer !== "all") active.push({ key: "composer", label: composerOptions.find((c) => c.id === filters.composer)?.name ?? filters.composer });
  if (filters.era !== "all") active.push({ key: "era", label: t.eraOptions[filters.era] });
  if (filters.sheet !== "all") active.push({ key: "sheet", label: t.sheetOptions[filters.sheet] });

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

      <FacetChips
        legend={t.players}
        allLabel={t.all}
        value={filters.players}
        options={playerCounts.map((v) => ({ value: v, label: t.playersOptions[v], n: counts.players.get(v) ?? 0 }))}
        onChange={(v) => update({ players: v })}
      />
      <FacetChips
        legend={t.instrument}
        help={t.instrumentHelp}
        allLabel={t.all}
        value={filters.inst}
        options={instruments.map((v) => ({ value: v, label: t.instrumentOptions[v], n: counts.inst.get(v) ?? 0 }))}
        onChange={(v) => update({ inst: v })}
      />
      <FacetChips
        legend={t.formation}
        allLabel={t.all}
        value={filters.fmt}
        options={formations.map((v) => ({ value: v, label: t.formationOptions[v], n: counts.fmt.get(v) ?? 0 }))}
        onChange={(v) => update({ fmt: v })}
      />
      <FacetChips
        legend={t.genre}
        allLabel={t.all}
        value={filters.genre}
        options={genres.map((v) => ({ value: v, label: t.genreOptions[v], n: counts.genre.get(v) ?? 0 }))}
        onChange={(v) => update({ genre: v })}
      />
      <FacetChips
        legend={t.sheet}
        help={t.sheetHelp}
        allLabel={t.all}
        value={filters.sheet}
        options={sheetKinds.map((v) => ({ value: v, label: t.sheetOptions[v], n: counts.sheet.get(v) ?? 0 }))}
        onChange={(v) => update({ sheet: v })}
      />

      {/* 作曲家・時代は件数が多い／使う頻度が低いので折りたたむ（選択中は開いておく） */}
      <details open={filters.composer !== "all" || filters.era !== "all" || undefined}>
        <summary className="cursor-pointer py-3 text-[13px] font-semibold">{t.advanced}</summary>
        <div className="my-2 grid gap-[7px]">
          <label htmlFor="composer" className="text-[13px] font-semibold">
            {t.composer}
          </label>
          <select
            id="composer"
            value={filters.composer}
            onChange={(event) => update({ composer: event.target.value })}
            className="w-full rounded-control border border-muted bg-card p-[13px] text-ink"
          >
            <option value="all">{t.composerAll}</option>
            {composerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.n}）
              </option>
            ))}
          </select>
        </div>
        <FacetChips
          legend={t.era}
          allLabel={t.all}
          value={filters.era}
          options={eras.map((v) => ({ value: v, label: t.eraOptions[v], n: counts.era.get(v) ?? 0 }))}
          onChange={(v) => update({ era: v })}
        />
      </details>

      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-[7px]" aria-label={t.active}>
          <span className="text-xs text-muted">{t.active}:</span>
          {active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => update({ [a.key]: "all" } as Partial<Filters>)}
              aria-label={t.removeFilter(a.label)}
              className="rounded-full border border-navy bg-card px-[11px] py-[5px] text-[13px] text-navy hover:bg-subtle"
            >
              {a.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-3.5 mt-6 flex items-center justify-between gap-3">
        <div aria-live="polite">
          <span className="text-[23px] font-bold">{results.length}</span> <span className="text-xs text-muted">{t.works}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFilters({ ...initialFilters, sort: filters.sort });
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

type FacetOption<T extends string> = { value: T; label: string; n: number };

// 絞り込みのチップ列。件数 0 の選択肢は出さない（選択中なら残す）。
// スマホでは 1 行で横にスクロールし、縦幅を取りすぎないようにする。幅に余裕があれば折り返す
function FacetChips<T extends string>({ legend, help, allLabel, value, options, onChange }: { legend: string; help?: string; allLabel: string; value: "all" | T; options: FacetOption<T>[]; onChange: (v: "all" | T) => void }) {
  const visible = options.filter((o) => o.n > 0 || o.value === value);
  if (visible.length === 0) return null;
  return (
    <fieldset className="my-3 min-w-0">
      <legend className="mb-[7px] text-[13px] font-semibold">
        {legend}
        {help && <span className="ml-2 text-xs font-normal text-muted">{help}</span>}
      </legend>
      <div className="-mx-1 flex gap-[7px] overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        <div className="flex-none">
          <Chip pressed={value === "all"} onClick={() => onChange("all")}>
            {allLabel}
          </Chip>
        </div>
        {visible.map((o) => (
          <div key={o.value} className="flex-none">
            <Chip pressed={value === o.value} onClick={() => onChange(value === o.value ? "all" : o.value)}>
              {o.label}
              <span className="ml-1 text-[11px] opacity-70">{o.n}</span>
            </Chip>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
