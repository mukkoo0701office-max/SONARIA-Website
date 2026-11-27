"use client";

import { useMemo, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { changeRatio, lastDays, lastMonths, revenueByPeriod, summarizeRevenue, trafficByDay, ym } from "../aggregate";
import { BarChart, DonutChart, LineChart } from "../charts";
import { fmtDate, fmtMoney, fmtMonth, fmtPercent, fmtShortDate } from "../i18n";
import { chartPrimary, chartSecondary, revenueColor } from "../theme";
import type { RevenueCategory, RevenueEntry } from "../types";
import { Badge, buttonSecondary, Card, inputClass, LoadState, NotConnected, PageTitle, Segmented, StatTile, Table } from "../ui";

const categories: RevenueCategory[] = ["adsense", "amazon", "recording", "performance", "lesson", "donation", "digital", "other"];

export default function RevenueView() {
  const { t, locale } = useAdmin();
  const today = new Date();
  const data = useAdminData(async (r) => {
    const [revenue, analytics] = await Promise.all([r.listRevenue(), r.listAnalytics(lastDays(today, 90)[0], lastDays(today, 1)[0])]);
    return { revenue, analytics };
  });
  const [gran, setGran] = useState<"day" | "month" | "year">("month");
  const [cat, setCat] = useState<"all" | RevenueCategory>("all");
  const [sort, setSort] = useState<"occurredOn" | "amount">("occurredOn");
  const money = (n: number) => fmtMoney(Math.round(n), locale);

  const entries = data.data?.revenue ?? [];
  const months = lastMonths(today, 13);
  const thisM = months[12];
  const prevM = months[11];
  const lastYearM = months[0];
  const sumOf = (m: string) => summarizeRevenue(entries.filter((e) => ym(e.occurredOn) === m));
  const cur = sumOf(thisM);
  const mom = changeRatio(cur.gross, sumOf(prevM).gross);
  const yoy = changeRatio(cur.gross, sumOf(lastYearM).gross);
  const last12 = months.slice(1);
  const total12 = summarizeRevenue(entries.filter((e) => last12.includes(ym(e.occurredOn))));

  const trend = useMemo(() => {
    if (gran === "day") {
      const days = lastDays(today, 30);
      return { labels: days.map((d) => fmtShortDate(d, locale)), table: revenueByPeriod(entries, days, (e) => e.occurredOn, categories) };
    }
    if (gran === "year") {
      const years = [...new Set(entries.map((e) => e.occurredOn.slice(0, 4)))].sort();
      return { labels: years, table: revenueByPeriod(entries, years, (e) => e.occurredOn.slice(0, 4), categories) };
    }
    return { labels: last12.map((m) => fmtMonth(m, locale)), table: revenueByPeriod(entries, last12, (e) => ym(e.occurredOn), categories) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, gran, locale]);

  const monthlyProfit = last12.map((m) => sumOf(m));
  // 広告収益と PV は単位が違うため、2 軸にせず、最初の月を 100 とした指数で比べる
  const adsByMonth = last12.map((m) => entries.filter((e) => ym(e.occurredOn) === m && (e.category === "adsense" || e.category === "amazon")).reduce((a, e) => a + e.amount, 0));
  const pvDays = lastDays(today, 90);
  const pv = data.data ? trafficByDay(data.data.analytics, pvDays).pv : [];
  const pvByMonth = last12.map((m) => pvDays.reduce((a, d, i) => (d.startsWith(m) ? a + pv[i] : a), 0));
  const firstIdx = pvByMonth.findIndex((v) => v > 0);
  const index = (arr: number[]) => arr.map((v, i) => (i < firstIdx || arr[firstIdx] === 0 ? 0 : (v / arr[firstIdx]) * 100));
  const idxLabels = last12.slice(firstIdx >= 0 ? firstIdx : 0);

  const rows = entries.filter((e) => cat === "all" || e.category === cat).sort((a, b) => (sort === "amount" ? b.amount - a.amount : b.occurredOn.localeCompare(a.occurredOn)));
  const hasEstimated = entries.some((e) => ym(e.occurredOn) === thisM && e.certainty === "estimated");

  return (
    <>
      <PageTitle
        title={t.revenue.title}
        lead={t.revenue.importNote}
        actions={
          <>
            <button type="button" disabled className={buttonSecondary} title={t.common.notConnected}>
              {t.revenue.addManual}
            </button>
            <button type="button" disabled className={buttonSecondary} title={t.common.notConnected}>
              {t.revenue.importCsv}
            </button>
          </>
        }
      />
      <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} onRetry={data.reload}>
        <p className="mb-2 text-[12px] font-semibold text-muted">
          {fmtMonth(thisM, locale)} {hasEstimated && <Badge tone="warn">{t.common.estimated}</Badge>}
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label={t.revenue.gross} value={money(cur.gross)} sub={`${t.revenue.mom} ${mom === null ? "—" : fmtPercent(mom, locale, true)}・${t.revenue.yoy} ${yoy === null ? "—" : fmtPercent(yoy, locale, true)}`} />
          <StatTile label={t.revenue.paid} value={money(cur.paid)} />
          <StatTile label={t.revenue.unpaid} value={money(cur.unpaid)} tone={cur.unpaid ? "warn" : "neutral"} />
          <StatTile label={t.revenue.profit} value={money(cur.profit)} />
          <StatTile label={t.revenue.expense} value={money(cur.expense)} />
          <StatTile label={t.revenue.fee} value={money(cur.fee)} />
          <StatTile label={t.revenue.refund} value={money(cur.refund)} />
          <StatTile label={`${t.common.total}（12）`} value={money(total12.gross)} sub={`${t.revenue.profit} ${money(total12.profit)}`} />
        </div>
        <p className="mt-2 text-[12px] text-muted">{t.revenue.estimatedNote}</p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card title={t.revenue.stacked} id="r-trend" actions={<Segmented label={t.revenue.trend} value={gran} onChange={setGran} options={(["day", "month", "year"] as const).map((g) => ({ value: g, label: t.revenue.granularity[g] }))} />}>
            <BarChart
              title={t.revenue.stacked}
              labels={trend.labels}
              stacked
              series={categories.map((c) => ({ key: c, label: t.revenueCategory[c], color: revenueColor[c], values: trend.table[c] }))}
              format={money}
            />
          </Card>
          <Card title={t.revenue.byCategory} id="r-donut">
            <DonutChart
              title={t.revenue.byCategory}
              items={categories.map((c) => ({ key: c, label: t.revenueCategory[c], color: revenueColor[c], value: entries.filter((e) => e.category === c && last12.includes(ym(e.occurredOn))).reduce((a, e) => a + e.amount, 0) }))}
              format={money}
            />
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title={t.revenue.salesVsProfit} id="r-profit">
            <LineChart
              title={t.revenue.salesVsProfit}
              labels={last12.map((m) => fmtMonth(m, locale))}
              series={[
                { key: "gross", label: t.revenue.gross, color: chartPrimary, values: monthlyProfit.map((s) => s.gross) },
                { key: "profit", label: t.revenue.profit, color: chartSecondary, values: monthlyProfit.map((s) => s.profit) },
              ]}
              format={money}
            />
          </Card>
          <Card title={t.revenue.adsVsTraffic} id="r-ads">
            <LineChart
              title={`${t.revenue.adsVsTraffic}（100 = ${idxLabels[0] ? fmtMonth(idxLabels[0], locale) : ""}）`}
              labels={idxLabels.map((m) => fmtMonth(m, locale))}
              series={[
                { key: "ads", label: `${t.revenueCategory.adsense} + ${t.revenueCategory.amazon}`, color: chartPrimary, values: index(adsByMonth).slice(firstIdx >= 0 ? firstIdx : 0) },
                { key: "pv", label: t.analytics.pv, color: chartSecondary, values: index(pvByMonth).slice(firstIdx >= 0 ? firstIdx : 0) },
              ]}
              format={(n) => n.toFixed(0)}
            />
          </Card>
        </div>

        <Card title={t.revenue.entries} id="r-entries" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="r-cat">
              {t.revenue.category}
            </label>
            <select id="r-cat" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className={`${inputClass} w-auto`}>
              <option value="all">
                {t.revenue.category}: {t.common.all}
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t.revenueCategory[c]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="r-sort">
              {t.common.sortBy}
            </label>
            <select id="r-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={`${inputClass} w-auto`}>
              <option value="occurredOn">
                {t.common.sortBy}: {t.revenue.occurredOn}
              </option>
              <option value="amount">{t.revenue.amount}</option>
            </select>
          </div>
          <Table
            caption={t.revenue.entries}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.revenue.occurredOn}</th>
                <th className="py-2 pr-3 font-semibold">{t.revenue.category}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.revenue.amount}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.revenue.fee}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.revenue.expense}</th>
                <th className="py-2 pr-3 font-semibold">{t.revenue.status}</th>
                <th className="py-2 pr-3 font-semibold">{t.revenue.paidOn}</th>
                <th className="py-2 pr-3 font-semibold">{t.revenue.certainty}</th>
                <th className="py-2 font-semibold">{t.revenue.source}</th>
              </tr>
            }
          >
            {rows.slice(0, 60).map((e: RevenueEntry) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(e.occurredOn, locale)}</td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: revenueColor[e.category] }} />
                    {t.revenueCategory[e.category]}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(e.amount)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted">{e.fee ? money(e.fee) : "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted">{e.expense ? money(e.expense) : "—"}</td>
                <td className="py-2 pr-3">
                  <Badge tone={e.paymentStatus === "paid" ? "good" : e.paymentStatus === "refunded" ? "neutral" : "warn"}>{e.paymentStatus === "paid" ? t.revenue.paid : e.paymentStatus === "refunded" ? t.payment.refunded : t.revenue.unpaid}</Badge>
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(e.paidOn, locale)}</td>
                <td className="py-2 pr-3">
                  <Badge tone={e.certainty === "estimated" ? "warn" : "neutral"}>{e.certainty === "estimated" ? t.common.estimated : t.common.confirmed}</Badge>
                </td>
                <td className="py-2">
                  <Badge>{e.source === "demo" ? t.common.demo : e.source}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <div className="mt-4">
          <NotConnected>{t.revenue.importNote}</NotConnected>
        </div>
      </LoadState>
    </>
  );
}
