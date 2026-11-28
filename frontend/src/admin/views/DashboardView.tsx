"use client";

import Link from "next/link";
import { useAdmin, useAdminData } from "../AdminContext";
import { changeRatio, todoCounts, lastDays, lastMonths, revenueByPeriod, summarizeRevenue, trafficByDay, ym } from "../aggregate";
import { BarChart, LineChart } from "../charts";
import { fmtDate, fmtMoney, fmtMonth, fmtNumber, fmtPercent, fmtShortDate } from "../i18n";
import { chartPrimary, chartSecondary, caseTone } from "../theme";
import { adminRoutes, Badge, Card, daysUntil, LoadState, PageTitle, StatTile } from "../ui";

export default function DashboardView() {
  const { t, locale } = useAdmin();
  const today = new Date();
  const days = lastDays(today, 7);
  const months = lastMonths(today, 12);

  const data = useAdminData(async (repo) => {
    const [inquiries, analytics, revenue, teachers, suspicious, calendar, notifications] = await Promise.all([
      repo.listInquiries(),
      repo.listAnalytics(lastDays(today, 7)[0], lastDays(today, 1)[0]),
      repo.listRevenue(),
      repo.listTeacherApplications(),
      repo.listSuspiciousClients(),
      repo.listCalendarEvents(),
      repo.listNotifications(),
    ]);
    return { inquiries, analytics, revenue, teachers, suspicious, calendar, notifications };
  });

  const d = data.data;
  const traffic = d ? trafficByDay(d.analytics, days) : { pv: [], visitors: [] };
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const monthSum = d ? summarizeRevenue(d.revenue.filter((e) => ym(e.occurredOn) === thisMonth)).gross : 0;
  const prevSum = d ? summarizeRevenue(d.revenue.filter((e) => ym(e.occurredOn) === prevMonth)).gross : 0;
  const mom = changeRatio(monthSum, prevSum);
  const monthly = d ? revenueByPeriod(d.revenue, months, (e) => ym(e.occurredOn), ["adsense", "amazon", "recording", "performance", "lesson", "donation", "digital", "other"]) : null;
  const monthlyTotals = monthly ? months.map((_, i) => Object.values(monthly).reduce((a, arr) => a + arr[i], 0)) : [];
  const hasEstimated = d ? d.revenue.some((e) => ym(e.occurredOn) === thisMonth && e.certainty === "estimated") : false;

  const unread = d?.inquiries.filter((i) => i.readState === "unread") ?? [];
  const unreplied = d?.inquiries.filter((i) => i.replyState === "unreplied" && i.caseStatus !== "cancelled") ?? [];
  const booked = d?.inquiries.filter((i) => i.caseStatus === "booked") ?? [];
  const dueSoon = d?.inquiries.filter((i) => {
    const n = daysUntil(i.dueDate);
    return n !== null && n <= 7 && !["completed", "cancelled", "delivered"].includes(i.caseStatus);
  }) ?? [];
  const teacherPending = d?.teachers.filter((a) => ["submitted", "under_review", "changes_requested"].includes(a.status)) ?? [];
  const suspicious = d?.suspicious.filter((s) => s.state !== "allowed") ?? [];
  const upcoming = (d?.calendar ?? []).filter((e) => !e.done && (daysUntil(e.start) ?? -1) >= 0).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
  const overdue = (d?.calendar ?? []).filter((e) => !e.done && (daysUntil(e.start) ?? 0) < 0 && (e.kind === "payment_due" || e.kind === "delivery_due"));
  const money = (n: number) => fmtMoney(n, locale);
  const todo = todoCounts(d?.inquiries ?? []);

  return (
    <>
      <PageTitle title={t.dashboard.title} />
      <LoadState status={data.status === "loading" && !d ? "loading" : data.status === "error" ? "error" : "ready"} onRetry={data.reload}>
        <section aria-labelledby="todo-title" className="mb-4">
          <h2 id="todo-title" className="mb-2 text-[15px] font-bold">{t.todo.title}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label={t.todo.new} value={fmtNumber(todo.new, locale)} tone={todo.new ? "info" : "neutral"} href={adminRoutes.inquiries} />
            <StatTile label={t.todo.scheduling} value={fmtNumber(todo.scheduling, locale)} tone={todo.scheduling ? "warn" : "neutral"} href={adminRoutes.inquiries} />
            <StatTile label={t.todo.priceToConfirm} value={fmtNumber(todo.priceToConfirm, locale)} tone={todo.priceToConfirm ? "warn" : "neutral"} href={adminRoutes.inquiries} />
            <StatTile label={t.todo.awaitingCard} value={fmtNumber(todo.awaitingCard, locale)} tone={todo.awaitingCard ? "info" : "neutral"} href={adminRoutes.inquiries} />
            <StatTile label={t.todo.awaitingBank} value={fmtNumber(todo.awaitingBank, locale)} tone={todo.awaitingBank ? "warn" : "neutral"} href={adminRoutes.inquiries} />
            <StatTile label={t.todo.inProgress} value={fmtNumber(todo.inProgress, locale)} tone="neutral" href={adminRoutes.inquiries} />
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile label={t.dashboard.todayPv} value={fmtNumber(traffic.pv[traffic.pv.length - 1] ?? 0, locale)} sub={<Badge tone="neutral">{t.common.demo}</Badge>} href={adminRoutes.analytics} />
          <StatTile label={t.dashboard.todayVisitors} value={fmtNumber(traffic.visitors[traffic.visitors.length - 1] ?? 0, locale)} href={adminRoutes.analytics} />
          <StatTile
            label={t.dashboard.monthRevenue}
            value={money(monthSum)}
            sub={
              <>
                {t.dashboard.mom} {mom === null ? "—" : fmtPercent(mom, locale, true)}
                {hasEstimated && <span className="ml-1">（{t.common.estimated}）</span>}
              </>
            }
            href={adminRoutes.revenue}
          />
          <StatTile label={t.dashboard.unread} value={fmtNumber(unread.length, locale)} tone={unread.length ? "info" : "neutral"} href={adminRoutes.inquiries} />
          <StatTile label={t.dashboard.unreplied} value={fmtNumber(unreplied.length, locale)} tone={unreplied.length ? "warn" : "neutral"} href={adminRoutes.inquiries} />
          <StatTile label={t.dashboard.booked} value={fmtNumber(booked.length, locale)} href={adminRoutes.calendar} />
          <StatTile label={t.dashboard.dueSoon} value={fmtNumber(dueSoon.length, locale)} sub={t.dashboard.within7} tone={dueSoon.length ? "warn" : "neutral"} href={adminRoutes.calendar} />
          <StatTile label={t.dashboard.teacherPending} value={fmtNumber(teacherPending.length, locale)} tone={teacherPending.length ? "info" : "neutral"} href={adminRoutes.teachers} />
          <StatTile label={t.dashboard.suspiciousPdf} value={fmtNumber(suspicious.length, locale)} tone={suspicious.length ? "danger" : "neutral"} href={adminRoutes.pdf} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title={t.dashboard.access7} id="dash-access">
            <LineChart
              title={t.dashboard.access7}
              labels={days.map((x) => fmtShortDate(x, locale))}
              series={[
                { key: "pv", label: t.analytics.pv, color: chartPrimary, values: traffic.pv },
                { key: "visitors", label: t.analytics.visitors, color: chartSecondary, values: traffic.visitors },
              ]}
              format={(n) => fmtNumber(Math.round(n), locale)}
            />
          </Card>
          <Card title={t.dashboard.monthlyRevenue} id="dash-revenue">
            <BarChart
              title={t.dashboard.monthlyRevenue}
              labels={months.map((m) => fmtMonth(m, locale))}
              series={[{ key: "total", label: t.common.total, color: chartPrimary, values: monthlyTotals }]}
              format={(n) => money(Math.round(n))}
            />
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card
            title={t.dashboard.latestInquiries}
            id="dash-latest"
            className="xl:col-span-2"
            actions={
              <Link href={adminRoutes.inquiries} className="text-[13px] text-navy underline">
                {t.dashboard.viewAll}
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {(d?.inquiries ?? []).slice(0, 5).map((i) => (
                <li key={i.id}>
                  <Link href={adminRoutes.inquiry(i.id)} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-paper">
                    {i.readState === "unread" && <span className="h-2 w-2 rounded-full bg-[#257de0]" aria-label={t.readState.unread} />}
                    <span className={`min-w-0 flex-1 truncate text-[14px] ${i.readState === "unread" ? "font-bold" : ""}`}>{i.subject}</span>
                    <Badge>{t.kinds[i.kind]}</Badge>
                    <Badge tone={caseTone[i.caseStatus]}>{t.caseStatus[i.caseStatus]}</Badge>
                    {i.replyState === "unreplied" && i.caseStatus !== "cancelled" && <Badge tone="warn">{t.replyState.unreplied}</Badge>}
                    <span className="w-full text-[12px] text-muted sm:w-auto">
                      {i.requester.name}・{fmtDate(i.receivedAt, locale, true)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t.dashboard.upcoming} id="dash-upcoming" actions={<Link href={adminRoutes.calendar} className="text-[13px] text-navy underline">{t.dashboard.viewAll}</Link>}>
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-muted">{t.calendar.noEvents}</p>
            ) : (
              <ul className="grid gap-2 text-[13px]">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="w-16 flex-none tabular-nums text-muted">{fmtShortDate(e.start, locale)}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{e.title}</span>
                      <span className="text-[11px] text-muted">{t.calendarKind[e.kind]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title={t.dashboard.actionItems} id="dash-actions">
            <ul className="grid gap-2 text-[13px]">
              {overdue.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{t.calendar.overdue}</Badge>
                  {e.inquiryId ? <Link href={adminRoutes.inquiry(e.inquiryId)} className="underline">{e.title}</Link> : e.title}
                </li>
              ))}
              {dueSoon.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn">{t.inquiries.dueDate} {fmtShortDate(i.dueDate!, locale)}</Badge>
                  <Link href={adminRoutes.inquiry(i.id)} className="underline">{i.subject}</Link>
                </li>
              ))}
              {unreplied.slice(0, 4).map((i) => (
                <li key={`u-${i.id}`} className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn">{t.replyState.unreplied}</Badge>
                  <Link href={adminRoutes.inquiry(i.id)} className="underline">{i.subject}</Link>
                </li>
              ))}
              {teacherPending.slice(0, 3).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{t.teacherStatus[a.status]}</Badge>
                  <Link href={adminRoutes.teachers} className="underline">{a.profile.displayName}</Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t.dashboard.system} id="dash-system" actions={<Link href={adminRoutes.notifications} className="text-[13px] text-navy underline">{t.dashboard.viewAll}</Link>}>
            <ul className="grid gap-2 text-[13px]">
              {(d?.notifications ?? []).slice(0, 5).map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={n.kind === "suspicious_pdf" || n.kind === "system_error" ? "danger" : n.read ? "neutral" : "info"}>{t.notificationKind[n.kind]}</Badge>
                  <span className="min-w-0 flex-1">{n.title}</span>
                  {n.channel === "email" && <Badge tone="warn">{t.notifications.delivery[n.delivery]}</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </LoadState>
    </>
  );
}
