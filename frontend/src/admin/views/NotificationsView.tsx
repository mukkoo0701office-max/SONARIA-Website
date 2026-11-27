"use client";

import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { fmtDate } from "../i18n";
import type { NotificationSetting } from "../types";
import { Badge, buttonPrimary, Card, LoadState, NotConnected, PageTitle, Table } from "../ui";

export default function NotificationsView() {
  const { t, locale, repo } = useAdmin();
  const data = useAdminData(async (r) => {
    const [list, settings, audit] = await Promise.all([r.listNotifications(), r.getNotificationSettings(), r.listAuditLog()]);
    return { list, settings, audit };
  });
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data.data) setSettings(data.data.settings.settings);
  }, [data.data]);

  async function save() {
    if (!repo) return;
    await repo.saveNotificationSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }
  const toggle = (i: number, key: "email" | "dashboard") => setSettings((s) => s.map((x, j) => (j === i ? { ...x, [key]: !x[key] } : x)));

  return (
    <>
      <PageTitle title={t.notifications.title} lead={t.notifications.lead} />
      <NotConnected>{t.detail.mailNotConnected}</NotConnected>
      <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} onRetry={data.reload}>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card title={t.notifications.settings} id="n-settings">
            <p className="mb-3 text-[13px]">
              <span className="font-semibold">{t.notifications.to}:</span> <span className="text-muted">{t.notifications.toValue}</span>
            </p>
            <Table
              caption={t.notifications.settings}
              head={
                <tr>
                  <th className="py-2 pr-3 font-semibold" />
                  <th className="py-2 pr-3 text-center font-semibold">{t.notifications.email}</th>
                  <th className="py-2 text-center font-semibold">{t.notifications.dashboard}</th>
                </tr>
              }
            >
              {settings.map((s, i) => (
                <tr key={s.kind}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {t.notificationKind[s.kind]}
                  </th>
                  <td className="py-2 pr-3 text-center">
                    <input type="checkbox" checked={s.email} onChange={() => toggle(i, "email")} aria-label={`${t.notificationKind[s.kind]}・${t.notifications.email}`} className="h-4 w-4 accent-navy" />
                  </td>
                  <td className="py-2 text-center">
                    <input type="checkbox" checked={s.dashboard} onChange={() => toggle(i, "dashboard")} aria-label={`${t.notificationKind[s.kind]}・${t.notifications.dashboard}`} className="h-4 w-4 accent-navy" />
                  </td>
                </tr>
              ))}
            </Table>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={save} className={buttonPrimary}>
                {t.common.save}
              </button>
              {saved && (
                <span role="status" className="text-[13px] text-muted">
                  {t.common.saved}
                </span>
              )}
            </div>
          </Card>
          <Card title={t.notifications.flow} id="n-flow">
            <ol className="grid gap-2 text-[13px]">
              {t.notifications.flowSteps.map((s, i) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card title={t.notifications.history} id="n-history" className="mt-4">
          <Table
            caption={t.notifications.history}
            head={
              <tr>
                <th className="py-2 pr-3 font-semibold">{t.inquiries.receivedAt}</th>
                <th className="py-2 pr-3 font-semibold">{t.inquiries.kind}</th>
                <th className="py-2 pr-3 font-semibold">{t.inquiries.subject}</th>
                <th className="py-2 pr-3 font-semibold">{t.notifications.to}</th>
                <th className="py-2 font-semibold">{t.inquiries.status}</th>
              </tr>
            }
          >
            {(data.data?.list ?? []).map((n) => (
              <tr key={n.id} className={n.read ? "" : "bg-[#f5f9fe]"}>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(n.createdAt, locale, true)}</td>
                <td className="py-2 pr-3">
                  <Badge tone={n.kind === "suspicious_pdf" || n.kind === "system_error" ? "danger" : "neutral"}>{t.notificationKind[n.kind]}</Badge>
                </td>
                <td className="py-2 pr-3">{n.title}</td>
                <td className="py-2 pr-3">{t.notifications.channel[n.channel]}</td>
                <td className="py-2">
                  <Badge tone={n.delivery === "sent" ? "good" : n.delivery === "failed" ? "danger" : "warn"}>{t.notifications.delivery[n.delivery]}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={t.notifications.audit} id="n-audit" className="mt-4">
          <ul className="grid gap-1 font-mono text-[12px]">
            {(data.data?.audit ?? []).map((a) => (
              <li key={a.id}>
                <span className="text-muted">{fmtDate(a.at, locale, true)}</span> {a.actor} <strong>{a.action}</strong> {a.target ?? ""} {a.detail ?? ""}
              </li>
            ))}
          </ul>
        </Card>
      </LoadState>
    </>
  );
}
