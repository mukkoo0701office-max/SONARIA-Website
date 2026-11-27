"use client";

import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { RankBars } from "../charts";
import { fmtDate, fmtNumber } from "../i18n";
import type { PdfAccessGrant, PdfAccessPolicy, PdfProtectionMode, SuspiciousClient } from "../types";
import { Badge, buttonDanger, buttonPrimary, buttonSecondary, Card, Field, inputClass, LoadState, Modal, NotConnected, PageTitle, StatTile, Table } from "../ui";

const modes: PdfProtectionMode[] = ["open", "protected", "strict"];

export default function PdfProtectionView() {
  const { t, locale, repo } = useAdmin();
  const data = useAdminData(async (r) => {
    const [policy, events, suspicious, grants] = await Promise.all([r.getPdfPolicy(), r.listPdfEvents(), r.listSuspiciousClients(), r.listPdfGrants()]);
    return { policy, events, suspicious, grants };
  });
  const [policy, setPolicy] = useState<PdfAccessPolicy | null>(null);
  const [saved, setSaved] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grant, setGrant] = useState<Omit<PdfAccessGrant, "id" | "createdAt" | "status">>({ clientName: "", contact: "", scope: "all", dailyLimit: 500 });
  useEffect(() => {
    if (data.data) setPolicy(data.data.policy);
  }, [data.data]);
  const n = (v: number) => fmtNumber(v, locale);

  const d = data.data;
  const todayCount = d?.events.length ?? 0;
  const byWork = new Map<string, number>();
  for (const e of d?.events ?? []) byWork.set(e.workId, (byWork.get(e.workId) ?? 0) + 1);
  const ranking = [...byWork.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const limited = (d?.suspicious ?? []).filter((s) => s.state === "rate_limited" || s.state === "blocked");

  async function savePolicy() {
    if (!repo || !policy) return;
    await repo.savePdfPolicy(policy);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }
  async function setState(c: SuspiciousClient, state: SuspiciousClient["state"]) {
    if (!repo) return;
    await repo.setClientState(c.clientHash, state);
    data.reload();
  }
  async function addGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!repo || !grant.clientName.trim()) return;
    await repo.saveGrant({ ...grant, clientName: grant.clientName.trim(), contact: grant.contact.trim() });
    setGrantOpen(false);
    setGrant({ clientName: "", contact: "", scope: "all", dailyLimit: 500 });
    data.reload();
  }
  const numField = (key: "perClientPerMinute" | "perClientPerDay" | "burstThreshold" | "signedUrlTtlSeconds", label: string) => (
    <Field label={label} htmlFor={`pdf-${key}`}>
      <input
        id={`pdf-${key}`}
        type="number"
        min={1}
        inputMode="numeric"
        value={policy?.[key] ?? ""}
        onChange={(e) => policy && setPolicy({ ...policy, [key]: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
        className={inputClass}
      />
    </Field>
  );

  return (
    <>
      <PageTitle title={t.pdf.title} lead={t.pdf.lead} />
      <NotConnected>{t.pdf.notApplied}</NotConnected>
      <LoadState status={data.status === "loading" && !d ? "loading" : data.status} onRetry={data.reload}>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label={t.pdf.todayDownloads} value={n(todayCount)} />
          <StatTile label={t.pdf.suspicious} value={n(d?.suspicious.filter((s) => s.state === "watching").length ?? 0)} tone="warn" />
          <StatTile label={t.pdf.limited} value={n(limited.length)} tone={limited.length ? "danger" : "neutral"} />
          <StatTile label={t.pdf.mode} value={policy ? t.pdfMode[policy.mode] : "—"} sub={policy ? `${t.common.updated}: ${fmtDate(policy.updatedAt, locale)}` : undefined} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card title={t.pdf.mode} id="pdf-mode">
            {policy && (
              <div className="grid gap-4">
                <fieldset className="grid gap-2 sm:grid-cols-3">
                  <legend className="sr-only">{t.pdf.mode}</legend>
                  {modes.map((m) => (
                    <label key={m} className={`flex cursor-pointer gap-2 rounded-control border p-3 text-[13px] ${policy.mode === m ? "border-navy bg-navy/5" : "border-muted"}`}>
                      <input type="radio" name="pdf-mode" checked={policy.mode === m} onChange={() => setPolicy({ ...policy, mode: m })} className="mt-0.5 accent-navy" />
                      <span>
                        <span className="block font-bold">{t.pdf.modes[m].name}</span>
                        <span className="block text-[12px] text-muted">{t.pdf.modes[m].desc}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div>
                  <p className="mb-2 text-[13px] font-semibold">{t.pdf.limits}</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {numField("perClientPerMinute", t.pdf.perMinute)}
                    {numField("perClientPerDay", t.pdf.perDay)}
                    {numField("burstThreshold", t.pdf.burst)}
                    {numField("signedUrlTtlSeconds", t.pdf.ttl)}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={policy.blockKnownAiCrawlers} onChange={(e) => setPolicy({ ...policy, blockKnownAiCrawlers: e.target.checked })} className="h-4 w-4 accent-navy" />
                  {t.pdf.blockAi}
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={policy.notifyOnSuspicious} onChange={(e) => setPolicy({ ...policy, notifyOnSuspicious: e.target.checked })} className="h-4 w-4 accent-navy" />
                  {t.pdf.notify}
                </label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={savePolicy} className={buttonPrimary}>
                    {t.pdf.savePolicy}
                  </button>
                  {saved && (
                    <span role="status" className="text-[13px] text-muted">
                      {t.common.saved}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
          <Card title={t.pdf.ranking} id="pdf-ranking">
            <RankBars items={ranking.map(([w, c]) => ({ key: w, label: w, value: c }))} format={n} />
          </Card>
        </div>

        <Card title={t.pdf.suspicious} id="pdf-suspicious" className="mt-4">
          <Table
            caption={t.pdf.suspicious}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.pdf.client}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.ua}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.country}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.pdf.lastHour}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.pdf.works}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.reason}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.state}</th>
                <th className="py-2 font-semibold" />
              </tr>
            }
          >
            {(d?.suspicious ?? []).map((c) => (
              <tr key={c.clientHash}>
                <td className="py-2 pr-3 font-mono text-[12px]">{c.clientHash}</td>
                <td className="py-2 pr-3">{c.userAgentFamily}</td>
                <td className="py-2 pr-3">{c.country ?? "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(c.downloadsLastHour)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(c.distinctWorks)}</td>
                <td className="py-2 pr-3 text-[12px]">{t.pdf.reasons[c.reason as keyof typeof t.pdf.reasons] ?? c.reason}</td>
                <td className="py-2 pr-3">
                  <Badge tone={c.state === "blocked" ? "danger" : c.state === "rate_limited" ? "warn" : c.state === "allowed" ? "good" : "info"}>{t.pdf.states[c.state]}</Badge>
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    {c.state !== "allowed" && (
                      <button type="button" onClick={() => setState(c, "allowed")} className="rounded-button border border-line px-2 py-1 text-[12px] hover:bg-subtle">
                        {t.pdf.allow}
                      </button>
                    )}
                    {c.state !== "rate_limited" && (
                      <button type="button" onClick={() => setState(c, "rate_limited")} className="rounded-button border border-line px-2 py-1 text-[12px] hover:bg-subtle">
                        {t.pdf.limit}
                      </button>
                    )}
                    {c.state !== "blocked" && (
                      <button type="button" onClick={() => setState(c, "blocked")} className="rounded-button border border-[#f2a7a7] px-2 py-1 text-[12px] text-[#8a1c1c] hover:bg-[#fdeeee]">
                        {t.pdf.block}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title={t.pdf.grants}
          id="pdf-grants"
          className="mt-4"
          actions={
            <button type="button" onClick={() => setGrantOpen(true)} className={buttonSecondary}>
              {t.pdf.addGrant}
            </button>
          }
        >
          <p className="mb-3 text-[12px] text-muted">{t.pdf.grantsLead}</p>
          <Table
            caption={t.pdf.grants}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.pdf.grantName}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.grantScope}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t.pdf.grantLimit}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.grantExpires}</th>
                <th className="py-2 pr-3 font-semibold">{t.pdf.grantStatus}</th>
                <th className="py-2 font-semibold" />
              </tr>
            }
          >
            {(d?.grants ?? []).map((g) => (
              <tr key={g.id}>
                <td className="py-2 pr-3">
                  {g.clientName}
                  <span className="block text-[11px] text-muted">{g.contact}</span>
                </td>
                <td className="py-2 pr-3">{t.pdf.grantScopes[g.scope]}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(g.dailyLimit)}</td>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(g.expiresOn, locale)}</td>
                <td className="py-2 pr-3">
                  <Badge tone={g.status === "active" ? "good" : "neutral"}>{t.pdf.grantStatuses[g.status]}</Badge>
                </td>
                <td className="py-2">
                  {g.status === "active" && (
                    <button type="button" onClick={async () => { await repo?.revokeGrant(g.id); data.reload(); }} className={buttonDanger}>
                      {t.pdf.revoke}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={t.pdf.notes} id="pdf-notes" className="mt-4">
          <ul className="grid list-disc gap-1.5 pl-5 text-[13px] leading-relaxed">
            {t.pdf.noteList.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Card>

        <Modal open={grantOpen} title={t.pdf.addGrant} onClose={() => setGrantOpen(false)}>
          <form onSubmit={addGrant} className="grid gap-3">
            <Field label={t.pdf.grantName} htmlFor="g-name">
              <input id="g-name" value={grant.clientName} onChange={(e) => setGrant({ ...grant, clientName: e.target.value })} required maxLength={120} className={inputClass} />
            </Field>
            <Field label={t.pdf.grantContact} htmlFor="g-contact">
              <input id="g-contact" value={grant.contact} onChange={(e) => setGrant({ ...grant, contact: e.target.value })} maxLength={200} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.pdf.grantScope} htmlFor="g-scope">
                <select id="g-scope" value={grant.scope} onChange={(e) => setGrant({ ...grant, scope: e.target.value as "all" | "works" })} className={inputClass}>
                  <option value="all">{t.pdf.grantScopes.all}</option>
                  <option value="works">{t.pdf.grantScopes.works}</option>
                </select>
              </Field>
              <Field label={t.pdf.grantLimit} htmlFor="g-limit">
                <input id="g-limit" type="number" min={1} value={grant.dailyLimit} onChange={(e) => setGrant({ ...grant, dailyLimit: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={inputClass} />
              </Field>
            </div>
            <Field label={t.pdf.grantExpires} htmlFor="g-exp">
              <input id="g-exp" type="date" value={grant.expiresOn ?? ""} onChange={(e) => setGrant({ ...grant, expiresOn: e.target.value || undefined })} className={inputClass} />
            </Field>
            <button type="submit" className={buttonPrimary}>
              {t.common.save}
            </button>
          </form>
        </Modal>
      </LoadState>
    </>
  );
}
