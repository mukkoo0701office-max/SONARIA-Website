"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { fmtDate } from "../i18n";
import { caseStatuses } from "../repository";
import { caseTone } from "../theme";
import type { CaseStatus, Inquiry, InquiryKind } from "../types";
import { adminRoutes, Badge, Card, daysUntil, inputClass, LoadState, PageTitle, Table } from "../ui";

const kinds: InquiryKind[] = ["lesson", "recording", "performance", "teacher", "bowing", "general"];
type Sort = "receivedAt" | "updatedAt" | "dueDate" | "scheduledAt";

// 絞り込みの状態は URL のクエリに残す（再読み込み・戻る操作で保たれる）
function readQuery() {
  const p = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return {
    q: p.get("q") ?? "",
    kind: (kinds as string[]).includes(p.get("kind") ?? "") ? (p.get("kind") as InquiryKind) : "all",
    status: (caseStatuses as readonly string[]).includes(p.get("status") ?? "") ? (p.get("status") as CaseStatus) : "all",
    unread: p.get("unread") === "1",
    unreplied: p.get("unreplied") === "1",
    sort: (["receivedAt", "updatedAt", "dueDate", "scheduledAt"].includes(p.get("sort") ?? "") ? p.get("sort") : "receivedAt") as Sort,
  };
}

export default function InquiriesView() {
  const { t, locale } = useAdmin();
  const data = useAdminData((repo) => repo.listInquiries());
  const [f, setF] = useState(readQuery);

  useEffect(() => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.kind !== "all") p.set("kind", f.kind);
    if (f.status !== "all") p.set("status", f.status);
    if (f.unread) p.set("unread", "1");
    if (f.unreplied) p.set("unreplied", "1");
    if (f.sort !== "receivedAt") p.set("sort", f.sort);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [f]);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const list = (data.data ?? []).filter(
      (i) =>
        (!q || `${i.requester.name} ${i.subject} ${i.receiptNo}`.toLowerCase().includes(q)) &&
        (f.kind === "all" || i.kind === f.kind) &&
        (f.status === "all" || i.caseStatus === f.status) &&
        (!f.unread || i.readState === "unread") &&
        (!f.unreplied || i.replyState === "unreplied"),
    );
    const key = (i: Inquiry) => (f.sort === "dueDate" ? i.dueDate ?? "9999" : f.sort === "scheduledAt" ? i.scheduledAt ?? "9999" : i[f.sort]);
    return list.sort((a, b) => (f.sort === "receivedAt" || f.sort === "updatedAt" ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
  }, [data.data, f]);

  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  return (
    <>
      <PageTitle title={t.inquiries.title} />
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <label className="sr-only" htmlFor="inq-q">
            {t.common.search}
          </label>
          <input id="inq-q" type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t.inquiries.searchPlaceholder} className={inputClass} />
          <div>
            <label className="sr-only" htmlFor="inq-kind">
              {t.inquiries.kind}
            </label>
            <select id="inq-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as InquiryKind | "all" })} className={inputClass}>
              <option value="all">
                {t.inquiries.kind}: {t.common.all}
              </option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="inq-status">
              {t.inquiries.status}
            </label>
            <select id="inq-status" value={f.status} onChange={(e) => set({ status: e.target.value as CaseStatus | "all" })} className={inputClass}>
              <option value="all">
                {t.inquiries.status}: {t.common.all}
              </option>
              {caseStatuses.map((s) => (
                <option key={s} value={s}>
                  {t.caseStatus[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="inq-sort">
              {t.common.sortBy}
            </label>
            <select id="inq-sort" value={f.sort} onChange={(e) => set({ sort: e.target.value as Sort })} className={inputClass}>
              <option value="receivedAt">
                {t.common.sortBy}: {t.inquiries.receivedAt}
              </option>
              <option value="updatedAt">{t.inquiries.updatedAt}</option>
              <option value="dueDate">{t.inquiries.dueDate}</option>
              <option value="scheduledAt">{t.inquiries.scheduledAt}</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.unread} onChange={(e) => set({ unread: e.target.checked })} className="h-4 w-4 accent-navy" />
            {t.inquiries.onlyUnread}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.unreplied} onChange={(e) => set({ unreplied: e.target.checked })} className="h-4 w-4 accent-navy" />
            {t.inquiries.onlyUnreplied}
          </label>
          <span className="ml-auto text-muted" aria-live="polite">
            {t.inquiries.count(rows.length)}
          </span>
        </div>
      </Card>

      <div className="mt-4">
        <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} empty={rows.length === 0} onRetry={data.reload}>
          {/* PC: 表 */}
          <div className="hidden rounded-card border border-line bg-card p-4 md:block">
            <Table
              caption={t.inquiries.title}
              head={
                <tr>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.receiptNo}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.receivedAt}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.kind}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.requester}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.subject}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.status}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.scheduledAt}</th>
                  <th className="py-2 pr-3 font-semibold">{t.inquiries.dueDate}</th>
                  <th className="py-2 font-semibold">{t.inquiries.updatedAt}</th>
                </tr>
              }
            >
              {rows.map((i) => {
                const due = daysUntil(i.dueDate);
                return (
                  <tr key={i.id} className={i.readState === "unread" ? "bg-[#f5f9fe]" : ""}>
                    <td className="py-2.5 pr-3 font-mono text-[12px]">
                      <Link href={adminRoutes.inquiry(i.id)} className="text-navy underline">
                        {i.receiptNo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3">{fmtDate(i.receivedAt, locale, true)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge>{t.kinds[i.kind]}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">{i.requester.name}</td>
                    <td className={`py-2.5 pr-3 ${i.readState === "unread" ? "font-bold" : ""}`}>
                      <Link href={adminRoutes.inquiry(i.id)} className="hover:underline">
                        {i.subject}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={caseTone[i.caseStatus]}>{t.caseStatus[i.caseStatus]}</Badge>
                        {i.readState === "unread" && <Badge tone="info">{t.readState.unread}</Badge>}
                        {i.replyState === "unreplied" && i.caseStatus !== "cancelled" && <Badge tone="warn">{t.replyState.unreplied}</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3">{fmtDate(i.scheduledAt, locale, true)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      {i.dueDate ? <Badge tone={due !== null && due < 0 ? "danger" : due !== null && due <= 3 ? "warn" : "neutral"}>{fmtDate(i.dueDate, locale)}</Badge> : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5">{fmtDate(i.updatedAt, locale, true)}</td>
                  </tr>
                );
              })}
            </Table>
          </div>
          {/* スマホ: カード */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((i) => (
              <li key={i.id}>
                <Link href={adminRoutes.inquiry(i.id)} className="block rounded-card border border-line bg-card p-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge>{t.kinds[i.kind]}</Badge>
                    <Badge tone={caseTone[i.caseStatus]}>{t.caseStatus[i.caseStatus]}</Badge>
                    {i.readState === "unread" && <Badge tone="info">{t.readState.unread}</Badge>}
                    {i.replyState === "unreplied" && i.caseStatus !== "cancelled" && <Badge tone="warn">{t.replyState.unreplied}</Badge>}
                  </div>
                  <p className={`mt-2 text-[15px] ${i.readState === "unread" ? "font-bold" : ""}`}>{i.subject}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    {i.requester.name}・{fmtDate(i.receivedAt, locale, true)}・{i.receiptNo}
                  </p>
                  {(i.dueDate || i.scheduledAt) && (
                    <p className="mt-1 text-[12px]">
                      {i.scheduledAt && `${t.inquiries.scheduledAt}: ${fmtDate(i.scheduledAt, locale, true)}　`}
                      {i.dueDate && `${t.inquiries.dueDate}: ${fmtDate(i.dueDate, locale)}`}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </LoadState>
      </div>
    </>
  );
}
