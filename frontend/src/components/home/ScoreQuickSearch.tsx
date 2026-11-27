"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Chip from "@/components/ui/Chip";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { genres, instruments, type Formation, type Genre, type Instrument, type WorkSummary } from "@/data/works";
import { localizedPath, type Locale } from "@/lib/i18n";
import { countBy, filtersToSearch, initialFilters, matchesFilters, playersKey, sheetKeys, type ScoreFilters } from "@/lib/scores/filters";
import { playerCounts, sheetKinds, type PlayersFilter, type SheetFilter } from "@/lib/scores/sheetType";

type Props = {
  locale: Locale;
  works: readonly WorkSummary[]; // 公開中の作品（楽譜検索ページと同じデータ。件数の表示に使う）
  composers: { id: string; name: string; href: string }[]; // 作品数の多い作曲家（ページ側で選ぶ）
  formations: readonly Formation[]; // 掲載作品がある編成だけ（ページ側でカタログから作る）
};

// トップページの楽譜検索（PR #24 §3 で改修）。
// 1. 曲名・作曲家（日英・別名・作品番号を横断）  2. 演奏人数のチップ  3. 譜面の種類のチップ  4. 楽器・編成・種類
// 条件を変えるたびに該当件数を表示し、「この条件で探す」で楽譜検索ページへ同じ条件（URL のクエリ）を引き継ぐ。
// 判定は lib/scores/filters.ts を楽譜検索ページと共有するため、件数は検索ページと一致する
export default function ScoreQuickSearch({ locale, works, composers, formations }: Props) {
  const dict = getDictionary(locale);
  const t = dict.homeScoreSearch;
  const s = dict.scores;
  const router = useRouter();
  const [filters, setFilters] = useState<ScoreFilters>(initialFilters);

  const total = works.length;
  const count = useMemo(() => works.filter((w) => matchesFilters(w, filters)).length, [works, filters]);
  const counts = useMemo(
    () => ({
      players: countBy(works, filters, "players", playersKey),
      sheet: countBy(works, filters, "sheet", sheetKeys),
      inst: countBy(works, filters, "inst", (w) => w.instruments),
      fmt: countBy(works, filters, "fmt", (w) => [w.formation]),
      genre: countBy(works, filters, "genre", (w) => [w.genre]),
    }),
    [works, filters],
  );
  const dirty = filtersToSearch(filters) !== "";
  const scoresPath = localizedPath(locale, pagePaths.scores);

  function update(patch: Partial<ScoreFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    router.push(`${scoresPath}${filtersToSearch(filters)}`);
  }

  const selectClass = "w-full rounded-control border border-muted bg-card p-[11px] text-[14px] text-ink";
  // 件数 0 の選択肢は出さない（選択中なら残す）。件数はほかの条件を適用した数
  const withCount = (label: string, n: number | undefined) => (locale === "ja" ? `${label}（${n ?? 0}）` : `${label} (${n ?? 0})`);

  return (
    <div className="rounded-card border border-line bg-card p-5 sm:p-8">
      <p className="text-[12px] font-semibold tracking-wide text-muted">{t.kicker}</p>
      <h2 id="score-search-heading" className="mt-1 text-xl font-bold sm:text-2xl">
        {t.heading}
      </h2>
      <p className="mt-1 text-sm text-muted">{total > 0 ? t.leadWithCount(total) : t.lead}</p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        {/* 1. 曲名・作曲家 */}
        <div className="grid gap-[7px]">
          <label htmlFor="quick-score-q" className="text-[13px] font-semibold">
            {t.keyword}
          </label>
          <input
            id="quick-score-q"
            type="search"
            autoComplete="off"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={t.placeholder}
            className="w-full rounded-control border border-muted bg-card p-[14px] text-[16px] text-ink"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 2. 演奏人数 */}
          <ChipRow
            legend={s.players}
            allLabel={s.all}
            value={filters.players}
            options={playerCounts.map((v) => ({ value: v, label: s.playersOptions[v], n: counts.players.get(v) ?? 0 }))}
            onChange={(v) => update({ players: v as PlayersFilter })}
          />
          {/* 3. 譜面の種類 */}
          <ChipRow
            legend={s.sheet}
            allLabel={s.all}
            value={filters.sheet}
            options={sheetKinds.map((v) => ({ value: v, label: s.sheetOptions[v], n: counts.sheet.get(v) ?? 0 }))}
            onChange={(v) => update({ sheet: v as SheetFilter })}
          />
        </div>

        {/* 4. 楽器・編成・種類（コンパクトに 1 行。スマホは 2 列） */}
        <fieldset className="min-w-0">
          <legend className="mb-[7px] text-[13px] font-semibold">{t.narrow}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="min-w-0">
              <label htmlFor="quick-score-inst" className="sr-only">
                {s.instrument}
              </label>
              <select id="quick-score-inst" value={filters.inst} onChange={(e) => update({ inst: e.target.value as "all" | Instrument })} className={selectClass}>
                <option value="all">
                  {s.instrument}: {s.all}
                </option>
                {instruments
                  .filter((v) => (counts.inst.get(v) ?? 0) > 0 || v === filters.inst)
                  .map((v) => (
                    <option key={v} value={v}>
                      {withCount(s.instrumentOptions[v], counts.inst.get(v))}
                    </option>
                  ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="quick-score-genre" className="sr-only">
                {s.genre}
              </label>
              <select id="quick-score-genre" value={filters.genre} onChange={(e) => update({ genre: e.target.value as "all" | Genre })} className={selectClass}>
                <option value="all">
                  {s.genre}: {s.all}
                </option>
                {genres
                  .filter((v) => (counts.genre.get(v) ?? 0) > 0 || v === filters.genre)
                  .map((v) => (
                    <option key={v} value={v}>
                      {withCount(s.genreOptions[v], counts.genre.get(v))}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <label htmlFor="quick-score-fmt" className="sr-only">
                {s.formation}
              </label>
              <select id="quick-score-fmt" value={filters.fmt} onChange={(e) => update({ fmt: e.target.value as "all" | Formation })} className={selectClass}>
                <option value="all">
                  {s.formation}: {s.all}
                </option>
                {formations
                  .filter((v) => (counts.fmt.get(v) ?? 0) > 0 || v === filters.fmt)
                  .map((v) => (
                    <option key={v} value={v}>
                      {withCount(s.formationOptions[v], counts.fmt.get(v))}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* 件数と 2 つの導線（条件から探す／すべて見る） */}
        <div className="grid gap-3 border-t border-line pt-4 sm:flex sm:flex-wrap sm:items-center">
          <p aria-live="polite" className="text-[14px] sm:mr-auto">
            {count === 0 ? <span className="font-bold">{t.noMatch}</span> : <span className="font-bold tabular-nums">{t.resultCount(count, total)}</span>}
            {dirty && (
              <button type="button" onClick={() => setFilters(initialFilters)} className="ml-3 text-[13px] text-navy underline">
                {t.clear}
              </button>
            )}
          </p>
          <button
            type="submit"
            disabled={count === 0}
            className="rounded-button border border-navy bg-navy px-6 py-[13px] text-[15px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.submitWithCount(count)}
          </button>
          <Link href={scoresPath} className="rounded-button border border-navy bg-card px-6 py-[13px] text-center text-[15px] font-semibold text-navy hover:bg-subtle">
            {t.viewAll(total)}
          </Link>
        </div>
      </form>

      {composers.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-semibold">{t.byComposer}</p>
          <ul className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {composers.map((c) => (
              <li key={c.id} className="flex-none">
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

// チップの 1 行。スマホでは横にスクロールして縦幅を取りすぎないようにする
function ChipRow({ legend, allLabel, value, options, onChange }: { legend: string; allLabel: string; value: string; options: { value: string; label: string; n: number }[]; onChange: (v: string) => void }) {
  const visible = options.filter((o) => o.n > 0 || o.value === value);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-[7px] text-[13px] font-semibold">{legend}</legend>
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
