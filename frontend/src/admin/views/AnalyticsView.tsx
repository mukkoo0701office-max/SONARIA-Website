"use client";

import { useMemo, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { bucket, lastDays, trafficByDay } from "../aggregate";
import { BarChart, LineChart, RankBars } from "../charts";
import { fmtNumber, fmtPercent, fmtShortDate } from "../i18n";
import { chartPrimary, chartSecondary } from "../theme";
import type { AnalyticsMetric } from "../types";
import { Card, inputClass, LoadState, NotConnected, PageTitle, Segmented, Table } from "../ui";

type Range = 7 | 30 | 90;
type Cat = "all" | AnalyticsMetric["category"];
const cats: AnalyticsMetric["category"][] = ["home", "scores", "work", "teachers", "service", "form", "other"];

export default function AnalyticsView() {
  const { t, locale } = useAdmin();
  const today = new Date();
  const [range, setRange] = useState<Range>(30);
  const [gran, setGran] = useState<"day" | "week" | "month">("day");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [sort, setSort] = useState<"pageviews" | "visitors" | "path">("pageviews");
  const days = lastDays(today, range);

  const data = useAdminData(
    async (r) => {
      const [metrics, referrers, devices, countries, downloads, forms] = await Promise.all([
        r.listAnalytics(days[0], days[days.length - 1]),
        r.trafficBreakdown("referrer"),
        r.trafficBreakdown("device"),
        r.trafficBreakdown("country"),
        r.scoreDownloads(),
        r.formFunnel(),
      ]);
      return { metrics, referrers, devices, countries, downloads, forms };
    },
    [range],
  );
  const d = data.data;
  const n = (v: number) => fmtNumber(Math.round(v), locale);

  const filtered = (d?.metrics ?? []).filter((m) => cat === "all" || m.category === cat);
  const traffic = trafficByDay(filtered, days);
  const pvB = bucket(days, traffic.pv, gran);
  const visB = bucket(days, traffic.visitors, gran);
  const totalPv = traffic.pv.reduce((a, b) => a + b, 0);
  const totalVisitors = traffic.visitors.reduce((a, b) => a + b, 0);

  const pages = useMemo(() => {
    const map = new Map<string, { path: string; category: AnalyticsMetric["category"]; pageviews: number; visitors: number }>();
    for (const m of filtered) {
      const row = map.get(m.path) ?? { path: m.path, category: m.category, pageviews: 0, visitors: 0 };
      row.pageviews += m.pageviews;
      row.visitors += m.visitors;
      map.set(m.path, row);
    }
    const query = q.trim().toLowerCase();
    return [...map.values()].filter((r) => !query || r.path.toLowerCase().includes(query)).sort((a, b) => (sort === "path" ? a.path.localeCompare(b.path) : b[sort] - a[sort]));
  }, [filtered, q, sort]);

  const byLocale = (["ja", "en"] as const).map((l) => filtered.filter((m) => m.locale === l).reduce((a, m) => a + m.pageviews, 0));

  return (
    <>
      <PageTitle
        title={t.analytics.title}
        actions={
          <Segmented
            label={t.common.period}
            value={String(range) as "7" | "30" | "90"}
            onChange={(v) => setRange(Number(v) as Range)}
            options={(["7", "30", "90"] as const).map((v) => ({ value: v, label: t.common.days(Number(v)) }))}
          />
        }
      />
      <NotConnected>{t.analytics.connectNote}</NotConnected>
      <LoadState status={data.status === "loading" && !d ? "loading" : data.status} onRetry={data.reload}>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="an-cat">
            {t.analytics.category}
          </label>
          <select id="an-cat" value={cat} onChange={(e) => setCat(e.target.value as Cat)} className={`${inputClass} w-auto`}>
            <option value="all">
              {t.analytics.category}: {t.common.all}
            </option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {t.analytics.categories[c]}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-muted">
            {t.analytics.pv} <strong className="text-ink">{n(totalPv)}</strong>・{t.analytics.visitors} <strong className="text-ink">{n(totalVisitors)}</strong>
          </span>
        </div>

        <Card title={`${t.analytics.pv}・${t.analytics.visitors}`} id="an-trend" className="mt-3" actions={<Segmented label={t.common.period} value={gran} onChange={setGran} options={(["day", "week", "month"] as const).map((g) => ({ value: g, label: t.analytics.granularity[g] }))} />}>
          <LineChart
            title={`${t.analytics.pv}・${t.analytics.visitors}`}
            labels={pvB.labels.map((l) => (gran === "month" ? l : fmtShortDate(l, locale)))}
            series={[
              { key: "pv", label: t.analytics.pv, color: chartPrimary, values: pvB.values },
              { key: "visitors", label: t.analytics.visitors, color: chartSecondary, values: visB.values },
            ]}
            format={n}
          />
        </Card>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card title={t.analytics.pages} id="an-pages">
            <div className="mb-3 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="an-q">
                {t.common.search}
              </label>
              <input id="an-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.common.search} className={`${inputClass} max-w-xs`} />
              <label className="sr-only" htmlFor="an-sort">
                {t.common.sortBy}
              </label>
              <select id="an-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={`${inputClass} w-auto`}>
                <option value="pageviews">
                  {t.common.sortBy}: {t.analytics.pv}
                </option>
                <option value="visitors">{t.analytics.visitors}</option>
                <option value="path">{t.analytics.path}</option>
              </select>
            </div>
            <Table
              caption={t.analytics.pages}
              head={
                <tr>
                  <th className="py-2 pr-3 font-semibold">{t.analytics.path}</th>
                  <th className="py-2 pr-3 font-semibold">{t.analytics.category}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t.analytics.pv}</th>
                  <th className="py-2 text-right font-semibold">{t.analytics.visitors}</th>
                </tr>
              }
            >
              {pages.map((p) => (
                <tr key={p.path}>
                  <td className="break-all py-2 pr-3 font-mono text-[12px]">{p.path}</td>
                  <td className="py-2 pr-3">{t.analytics.categories[p.category]}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(p.pageviews)}</td>
                  <td className="py-2 text-right tabular-nums">{n(p.visitors)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <div className="grid content-start gap-4">
            <Card title={t.analytics.locales} id="an-locales">
              <BarChart title={t.analytics.locales} labels={["日本語", "English"]} series={[{ key: "pv", label: t.analytics.pv, color: chartPrimary, values: byLocale }]} format={n} height={180} />
            </Card>
            <Card title={t.analytics.referrers} id="an-ref">
              <RankBars items={(d?.referrers ?? []).map((r) => ({ key: r.label, label: r.label, value: r.value }))} format={n} />
            </Card>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title={t.analytics.devices} id="an-dev">
            <RankBars items={(d?.devices ?? []).map((r) => ({ key: r.label, label: r.label, value: r.value }))} format={n} />
          </Card>
          <Card title={t.analytics.countries} id="an-country">
            <RankBars items={(d?.countries ?? []).map((r) => ({ key: r.label, label: r.label, value: r.value }))} format={n} />
          </Card>
          <Card title={t.analytics.ranking} id="an-dl">
            <RankBars items={(d?.downloads ?? []).map((r) => ({ key: r.workId, label: r.title, value: r.downloads }))} format={n} />
          </Card>
        </div>

        <Card title={t.analytics.forms} id="an-forms" className="mt-4">
          <Table
            caption={t.analytics.forms}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.inquiries.kind}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.analytics.formViews}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.analytics.formSubmits}</th>
                <th className="py-2 text-right font-semibold">{t.analytics.formRate}</th>
              </tr>
            }
          >
            {(d?.forms ?? []).map((f) => (
              <tr key={f.kind}>
                <td className="py-2 pr-3">{t.kinds[f.kind as keyof typeof t.kinds] ?? f.kind}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(f.views)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(f.submissions)}</td>
                <td className="py-2 text-right tabular-nums">{fmtPercent(f.views ? f.submissions / f.views : 0, locale)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </LoadState>
    </>
  );
}
