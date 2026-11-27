"use client";

import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { bucket, changeRatio, lastDays } from "../aggregate";
import { BarChart, LineChart, RankBars } from "../charts";
import { fmtDate, fmtMoney, fmtNumber, fmtPercent, fmtShortDate } from "../i18n";
import { chartPrimary, chartSecondary } from "../theme";
import type { AdSettings, MetricOrigin } from "../types";
import { Badge, buttonPrimary, Card, Field, inputClass, LoadState, NotConnected, PageTitle, Segmented, StatTile, Table } from "../ui";

export default function AdsView() {
  const { t } = useAdmin();
  const [tab, setTab] = useState<"analysis" | "settings">("analysis");
  return (
    <>
      <PageTitle
        title={t.ads.title}
        lead={t.ads.lead}
        actions={<Segmented label={t.ads.title} value={tab} onChange={setTab} options={(["analysis", "settings"] as const).map((v) => ({ value: v, label: t.ads.tabs[v] }))} />}
      />
      <NotConnected>{t.ads.notConnected}</NotConnected>
      <div className="mt-4">{tab === "analysis" ? <Analysis /> : <Settings />}</div>
    </>
  );
}

function Origin({ o }: { o: MetricOrigin }) {
  const { t } = useAdmin();
  return <Badge tone={o === "adsense_api" ? "info" : "neutral"}>{t.ads.origins[o]}</Badge>;
}

function Analysis() {
  const { t, locale } = useAdmin();
  const today = new Date();
  const [range, setRange] = useState<"30" | "90">("30");
  const [gran, setGran] = useState<"day" | "month">("day");
  const days = lastDays(today, Number(range));
  const all90 = lastDays(today, 90);
  const data = useAdminData(
    async (r) => {
      const [report, site, site90] = await Promise.all([r.getAdReport(days[0], days[days.length - 1]), r.siteDaily(days[0], days[days.length - 1]), r.siteDaily(all90[0], all90[all90.length - 1])]);
      return { report, site, site90 };
    },
    [range],
  );
  const d = data.data;
  const money = (n: number) => fmtMoney(Math.round(n), locale);
  const num = (n: number) => fmtNumber(Math.round(n), locale);

  const byDay = new Map((d?.report.daily ?? []).map((x) => [x.date, x]));
  const earnings = days.map((k) => byDay.get(k)?.estimatedEarnings ?? 0);
  const siteByDay = new Map((d?.site ?? []).map((x) => [x.date, x]));
  const pv = days.map((k) => siteByDay.get(k)?.pageviews ?? 0);
  const downloads = days.map((k) => siteByDay.get(k)?.pdfDownloads ?? 0);
  const totalEarnings = earnings.reduce((a, b) => a + b, 0);
  const totalImpr = (d?.report.daily ?? []).reduce((a, x) => a + x.impressions, 0);
  const totalAdPv = (d?.report.daily ?? []).reduce((a, x) => a + x.adsensePageviews, 0);
  const rpm = totalAdPv ? (totalEarnings / totalAdPv) * 1000 : 0;
  const totalDl = downloads.reduce((a, b) => a + b, 0);
  const trend = bucket(days, earnings, gran);

  // 導入前後（直近 90 日を導入日で分けて、1 日あたりの平均で比べる）
  const launch = d?.report.launchDate ?? null;
  const split = (pick: (x: { pageviews: number; pdfDownloads: number; workPageviews: number }) => number) => {
    const before = (d?.site90 ?? []).filter((x) => launch && x.date < launch);
    const after = (d?.site90 ?? []).filter((x) => launch && x.date >= launch);
    const avg = (arr: typeof before) => (arr.length ? arr.reduce((a, x) => a + pick(x), 0) / arr.length : 0);
    return { before: avg(before), after: avg(after) };
  };
  const rateOf = (arr: { pdfDownloads: number; workPageviews: number }[]) => {
    const w = arr.reduce((a, x) => a + x.workPageviews, 0);
    return w ? arr.reduce((a, x) => a + x.pdfDownloads, 0) / w : 0;
  };
  const pvBA = split((x) => x.pageviews);
  const dlBA = split((x) => x.pdfDownloads);
  const rateBefore = rateOf((d?.site90 ?? []).filter((x) => launch && x.date < launch));
  const rateAfter = rateOf((d?.site90 ?? []).filter((x) => launch && x.date >= launch));
  const rateNow = rateOf(d?.site ?? []);
  const labels = days.map((k) => fmtShortDate(k, locale));
  const change = (a: number, b: number) => {
    const c = changeRatio(b, a);
    return c === null ? "—" : fmtPercent(c, locale, true);
  };

  return (
    <LoadState status={data.status === "loading" && !d ? "loading" : data.status} onRetry={data.reload}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">{t.ads.originNote}</p>
        <Segmented label={t.common.period} value={range} onChange={setRange} options={(["30", "90"] as const).map((v) => ({ value: v, label: t.common.days(Number(v)) }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label={t.ads.earnings} value={money(totalEarnings)} sub={<Origin o="adsense_api" />} />
        <StatTile label={t.ads.pageRpm} value={money(rpm)} sub={<Origin o="adsense_api" />} />
        <StatTile label={t.ads.impressions} value={num(totalImpr)} sub={<Origin o="adsense_api" />} />
        <StatTile label={t.ads.downloads} value={num(totalDl)} sub={<Origin o="site" />} />
        <StatTile label={t.ads.downloadRate} value={fmtPercent(rateNow, locale)} sub={<Origin o="site" />} />
      </div>
      <p className="mt-2 text-[12px] text-muted">{t.ads.estimatedNote}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card title={t.ads.earningsTrend} id="ads-trend" actions={<Segmented label={t.ads.earningsTrend} value={gran} onChange={setGran} options={(["day", "month"] as const).map((g) => ({ value: g, label: t.revenue.granularity[g] }))} />}>
          <BarChart title={t.ads.earningsTrend} labels={gran === "day" ? trend.labels.map((k) => fmtShortDate(k, locale)) : trend.labels} series={[{ key: "e", label: t.ads.earnings, color: chartPrimary, values: trend.values }]} format={money} />
        </Card>
        <Card title={t.ads.byPage} id="ads-pages" actions={<Origin o="adsense_api" />}>
          <RankBars items={(d?.report.byPage ?? []).map((p) => ({ key: p.key, label: p.label, value: p.estimatedEarnings }))} format={money} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={t.ads.pvVsEarnings} id="ads-pv">
          <p className="mb-2 text-[12px] text-muted">{t.ads.smallMultiplesNote}</p>
          <p className="text-[12px] font-semibold">
            {t.analytics.pv} <Origin o="site" />
          </p>
          <LineChart title={t.analytics.pv} labels={labels} series={[{ key: "pv", label: t.analytics.pv, color: chartSecondary, values: pv }]} format={num} height={150} />
          <p className="mt-2 text-[12px] font-semibold">
            {t.ads.earnings} <Origin o="adsense_api" />
          </p>
          <LineChart title={t.ads.earnings} labels={labels} series={[{ key: "e", label: t.ads.earnings, color: chartPrimary, values: earnings }]} format={money} height={150} />
        </Card>
        <Card title={t.ads.dlVsEarnings} id="ads-dl">
          <p className="mb-2 text-[12px] text-muted">{t.ads.smallMultiplesNote}</p>
          <p className="text-[12px] font-semibold">
            {t.ads.downloads} <Origin o="site" />
          </p>
          <LineChart title={t.ads.downloads} labels={labels} series={[{ key: "dl", label: t.ads.downloads, color: chartSecondary, values: downloads }]} format={num} height={150} />
          <p className="mt-2 text-[12px] font-semibold">
            {t.ads.earnings} <Origin o="adsense_api" />
          </p>
          <LineChart title={t.ads.earnings} labels={labels} series={[{ key: "e", label: t.ads.earnings, color: chartPrimary, values: earnings }]} format={money} height={150} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={t.ads.beforeAfter} id="ads-ba" actions={launch ? <span className="text-[12px] text-muted">{t.ads.launchDate}: {fmtDate(launch, locale)}</span> : null}>
          <Table
            caption={t.ads.beforeAfter}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold" />
                <th className="py-2 pr-3 text-right font-semibold">{t.ads.before}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.ads.after}</th>
                <th className="py-2 text-right font-semibold">{t.ads.change}</th>
              </tr>
            }
          >
            <tr>
              <th scope="row" className="py-2 pr-3 text-left font-normal">{t.ads.avgDailyPv}</th>
              <td className="py-2 pr-3 text-right tabular-nums">{num(pvBA.before)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(pvBA.after)}</td>
              <td className="py-2 text-right tabular-nums">{change(pvBA.before, pvBA.after)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 text-left font-normal">{t.ads.avgDailyDl}</th>
              <td className="py-2 pr-3 text-right tabular-nums">{num(dlBA.before)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(dlBA.after)}</td>
              <td className="py-2 text-right tabular-nums">{change(dlBA.before, dlBA.after)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 text-left font-normal">{t.ads.downloadRate}</th>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtPercent(rateBefore, locale)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtPercent(rateAfter, locale)}</td>
              <td className="py-2 text-right tabular-nums">{change(rateBefore, rateAfter)}</td>
            </tr>
          </Table>
          <p className="mt-2 text-[12px] text-muted">
            <Origin o="site" /> {t.ads.downloadRateNote}
          </p>
        </Card>
        <Card title={t.ads.byUnit} id="ads-units" actions={<Origin o="adsense_api" />}>
          <Table
            caption={t.ads.byUnit}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.ads.unit}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.ads.impressions}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.ads.pageRpm}</th>
                <th className="py-2 text-right font-semibold">{t.ads.earnings}</th>
              </tr>
            }
          >
            {(d?.report.byUnit ?? []).map((u) => (
              <tr key={u.key}>
                <td className="py-2 pr-3">
                  <span className="font-mono text-[12px]">{u.label}</span>
                  <span className="block text-[11px] text-muted">{t.ads.unitPlacement["after-downloads"]}</span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{num(u.impressions)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(u.adsensePageviews ? (u.estimatedEarnings / u.adsensePageviews) * 1000 : 0)}</td>
                <td className="py-2 text-right tabular-nums">{money(u.estimatedEarnings)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </LoadState>
  );
}

function Settings() {
  const { t, locale, repo } = useAdmin();
  const data = useAdminData((r) => r.getAdSettings());
  const [s, setS] = useState<AdSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data.data) setS(data.data);
  }, [data.data]);
  const idError = s && s.publisherId !== "" && !/^ca-pub-\d{16}$/.test(s.publisherId);

  async function save() {
    if (!repo || !s || idError) return;
    await repo.saveAdSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }
  const onOff = (v: boolean) => <Badge tone={v ? "warn" : "neutral"}>{v ? t.ads.on : t.ads.off}</Badge>;

  return (
    <LoadState status={data.status === "loading" && !s ? "loading" : data.status} onRetry={data.reload}>
      {s && (
        <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
          <Card title={t.ads.siteManaged} id="ads-site">
            <p className="mb-4 text-[12px] leading-relaxed text-muted">{t.ads.siteManagedNote}</p>
            <div className="grid gap-4">
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={s.adsenseEnabled} onChange={(e) => setS({ ...s, adsenseEnabled: e.target.checked })} className="h-4 w-4 accent-navy" />
                {t.ads.adsenseEnabled}
              </label>
              <Field label={t.ads.publisherId} htmlFor="ads-pub" hint={idError ? t.ads.publisherIdError : undefined}>
                <input id="ads-pub" value={s.publisherId} onChange={(e) => setS({ ...s, publisherId: e.target.value.trim() })} placeholder="ca-pub-0000000000000000" aria-invalid={!!idError} className={`${inputClass} font-mono`} />
              </Field>
              <fieldset>
                <legend className="mb-2 text-[12px] font-semibold text-muted">{t.ads.targetPages}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["work", "composer", "category"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-[14px]">
                      <input type="checkbox" checked={s.pages[p]} onChange={(e) => setS({ ...s, pages: { ...s.pages, [p]: e.target.checked } })} className="h-4 w-4 accent-navy" />
                      {t.ads.pageNames[p]}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-muted">{t.ads.neverPages}</p>
              </fieldset>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-muted">{t.ads.units}</p>
                <ul className="grid gap-2">
                  {s.units.map((u, i) => (
                    <li key={u.id} className="grid gap-2 rounded-control border border-line p-3 sm:grid-cols-[auto_1fr_200px] sm:items-center">
                      <input
                        type="checkbox"
                        checked={u.enabled}
                        aria-label={t.ads.unitPlacement[u.placement]}
                        onChange={(e) => setS({ ...s, units: s.units.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) })}
                        className="h-4 w-4 accent-navy"
                      />
                      <span className="text-[13px]">
                        <span className="font-mono text-[12px]">{u.id}</span>
                        <span className="block text-muted">{t.ads.unitPlacement[u.placement]}</span>
                      </span>
                      <span>
                        <label className="sr-only" htmlFor={`ads-slot-${u.id}`}>
                          {t.ads.slotId}
                        </label>
                        <input
                          id={`ads-slot-${u.id}`}
                          value={u.slot}
                          inputMode="numeric"
                          placeholder={t.ads.slotId}
                          onChange={(e) => setS({ ...s, units: s.units.map((x, j) => (j === i ? { ...x, slot: e.target.value.replace(/\D/g, "") } : x)) })}
                          className={`${inputClass} font-mono`}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={s.amazonEnabled} onChange={(e) => setS({ ...s, amazonEnabled: e.target.checked })} className="h-4 w-4 accent-navy" />
                {t.ads.amazonEnabled}
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={!!idError} className={buttonPrimary}>
                  {t.ads.save}
                </button>
                {saved && (
                  <span role="status" className="text-[13px] text-muted">
                    {t.common.saved}
                  </span>
                )}
                <span className="text-[12px] text-muted">
                  {t.common.updated}: {fmtDate(s.updatedAt, locale, true)}
                </span>
              </div>
            </div>
          </Card>

          <div className="grid content-start gap-4">
            <Card title={t.ads.googleManaged} id="ads-google">
              <p className="mb-3 text-[12px] leading-relaxed text-muted">{t.ads.googleManagedNote}</p>
              <dl className="grid gap-0 text-[13px]">
                {(
                  [
                    [t.ads.autoAds, onOff(s.googleManaged.autoAds)],
                    [t.ads.vignette, onOff(s.googleManaged.vignette)],
                    [t.ads.anchor, onOff(s.googleManaged.anchor)],
                    [t.ads.cmp, <Badge key="cmp" tone={s.googleManaged.cmpConfigured ? "good" : "warn"}>{s.googleManaged.cmpConfigured ? t.ads.configured : t.ads.notConfigured}</Badge>],
                    [t.ads.adsTxt, <Badge key="adstxt" tone={s.googleManaged.adsTxt === "ok" ? "good" : "warn"}>{t.ads.adsTxtStates[s.googleManaged.adsTxt]}</Badge>],
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card title={t.ads.status} id="ads-status">
              <dl className="grid gap-2 text-[13px]">
                {(
                  [
                    [t.ads.statusRows.script, t.ads.statusRows.scriptValue],
                    [t.ads.statusRows.units, t.ads.statusRows.unitsValue],
                    [t.ads.statusRows.amazon, t.ads.statusRows.amazonValue],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] font-semibold text-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card title={t.ads.policyHeading} id="ads-policy">
              <ul className="grid list-disc gap-1.5 pl-5 text-[13px] leading-relaxed">
                {t.ads.policyList.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </LoadState>
  );
}
