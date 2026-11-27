"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { calendarColor } from "../theme";
import type { CalendarEvent, CalendarEventKind } from "../types";
import { adminRoutes, Badge, buttonSecondary, Card, daysUntil, LoadState, PageTitle, Segmented } from "../ui";

type View = "month" | "week" | "day";
const kinds: CalendarEventKind[] = ["performance", "lesson", "recording", "delivery_due", "payment_due", "other"];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // 月曜はじまり
  return x;
};

/** 時間の重なり（終日の予定は除く） */
function overlaps(e: CalendarEvent, all: CalendarEvent[]) {
  if (e.allDay) return false;
  const s = new Date(e.start).getTime();
  const en = new Date(e.end ?? e.start).getTime();
  return all.some((o) => o.id !== e.id && !o.allDay && new Date(o.start).getTime() < en && new Date(o.end ?? o.start).getTime() > s);
}

export default function CalendarView() {
  const { t, locale } = useAdmin();
  const data = useAdminData((r) => r.listCalendarEvents());
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const events = data.data ?? [];
  const todayKey = dayKey(new Date());
  const loc = locale === "ja" ? "ja-JP" : "en-GB";

  const isOverdue = (e: CalendarEvent) => !e.done && (e.kind === "delivery_due" || e.kind === "payment_due") && (daysUntil(e.start) ?? 0) < 0;
  const eventsOn = (key: string) => events.filter((e) => e.start.slice(0, 10) === key).sort((a, b) => a.start.localeCompare(b.start));
  const time = (iso: string) => new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  function move(dir: -1 | 1) {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir, 1);
    else d.setDate(d.getDate() + (view === "week" ? 7 : 1) * dir);
    setCursor(d);
  }

  const title =
    view === "month"
      ? new Intl.DateTimeFormat(loc, { year: "numeric", month: "long" }).format(cursor)
      : view === "week"
        ? (() => {
            const s0 = startOfWeek(cursor);
            const e0 = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + 6);
            const f = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric" });
            return `${f.format(s0)} – ${f.format(e0)}`;
          })()
        : new Intl.DateTimeFormat(loc, { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(cursor);

  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: "short" }).format(new Date(2024, 0, 1 + i)));

  function EventChip({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
    const over = isOverdue(e);
    const clash = overlaps(e, events);
    const inner = (
      <span className={`flex items-start gap-1.5 rounded-[6px] border px-1.5 py-1 text-left text-[12px] leading-tight ${over ? "border-[#dc3c3d] bg-[#fdeeee]" : "border-line bg-card"} ${e.done ? "opacity-60" : ""}`}>
        <span aria-hidden="true" className="mt-1 inline-block h-2 w-2 flex-none rounded-full" style={{ background: calendarColor[e.kind] }} />
        <span className="min-w-0">
          {!e.allDay && <span className="mr-1 tabular-nums text-muted">{time(e.start)}</span>}
          <span className={compact ? "line-clamp-2" : ""}>{e.title}</span>
          <span className="sr-only">（{t.calendarKind[e.kind]}）</span>
          {over && <span className="ml-1 font-bold text-[#8a1c1c]">{t.calendar.overdue}</span>}
          {clash && (
            <span className="ml-1 text-[#6b4a00]" title={t.calendar.overlap}>
              ⚠<span className="sr-only">{t.calendar.overlap}</span>
            </span>
          )}
        </span>
      </span>
    );
    return e.inquiryId ? (
      <Link href={adminRoutes.inquiry(e.inquiryId)} className="block hover:brightness-95" aria-label={`${e.title}・${t.calendar.openCase}`}>
        {inner}
      </Link>
    ) : (
      inner
    );
  }

  let body: React.ReactNode;
  if (view === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    body = (
      <>
        {/* PC: 月のマス目 */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 border-b border-line text-center text-[12px] text-muted">
            {weekdays.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c) => {
              const key = dayKey(c);
              const list = eventsOn(key);
              const inMonth = c.getMonth() === cursor.getMonth();
              return (
                <div key={key} className={`min-h-[104px] border-b border-r border-line p-1 ${inMonth ? "" : "bg-paper"}`}>
                  <p className={`mb-1 text-right text-[12px] tabular-nums ${key === todayKey ? "font-bold text-navy" : inMonth ? "" : "text-muted"}`}>
                    {key === todayKey ? <span className="rounded-full bg-navy px-1.5 py-0.5 text-white">{c.getDate()}</span> : c.getDate()}
                  </p>
                  <div className="grid gap-1">
                    {list.slice(0, 3).map((e) => (
                      <EventChip key={e.id} e={e} compact />
                    ))}
                    {list.length > 3 && (
                      <button type="button" className="text-left text-[11px] text-navy underline" onClick={() => { setCursor(c); setView("day"); }}>
                        +{list.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* スマホ: 予定のある日の一覧 */}
        <ul className="grid gap-3 md:hidden">
          {cells
            .filter((c) => c.getMonth() === cursor.getMonth() && eventsOn(dayKey(c)).length > 0)
            .map((c) => (
              <li key={dayKey(c)}>
                <p className={`mb-1 text-[13px] font-semibold ${dayKey(c) === todayKey ? "text-navy" : ""}`}>{new Intl.DateTimeFormat(loc, { month: "short", day: "numeric", weekday: "short" }).format(c)}</p>
                <div className="grid gap-1">
                  {eventsOn(dayKey(c)).map((e) => (
                    <EventChip key={e.id} e={e} />
                  ))}
                </div>
              </li>
            ))}
        </ul>
      </>
    );
  } else if (view === "week") {
    const start = startOfWeek(cursor);
    const daysOfWeek = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    body = (
      <div className="grid gap-2 md:grid-cols-7">
        {daysOfWeek.map((c) => {
          const key = dayKey(c);
          return (
            <div key={key} className={`min-h-[120px] rounded-control border p-2 ${key === todayKey ? "border-navy" : "border-line"}`}>
              <p className="mb-2 text-[12px] font-semibold">{new Intl.DateTimeFormat(loc, { weekday: "short", month: "numeric", day: "numeric" }).format(c)}</p>
              <div className="grid gap-1">
                {eventsOn(key).length === 0 ? <p className="text-[11px] text-muted">—</p> : eventsOn(key).map((e) => <EventChip key={e.id} e={e} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const list = eventsOn(dayKey(cursor));
    body =
      list.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">{t.calendar.noEvents}</p>
      ) : (
        <ol className="grid gap-2">
          {list.map((e) => (
            <li key={e.id} className="grid grid-cols-[80px_1fr] items-start gap-3">
              <span className="pt-1 text-[13px] tabular-nums text-muted">{e.allDay ? t.calendar.allDay : `${time(e.start)}${e.end ? `–${time(e.end)}` : ""}`}</span>
              <EventChip e={e} />
            </li>
          ))}
        </ol>
      );
  }

  return (
    <>
      <PageTitle title={t.calendar.title} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => move(-1)} className={buttonSecondary} aria-label={t.calendar.prev}>
              ←
            </button>
            <button type="button" onClick={() => setCursor(new Date())} className={buttonSecondary}>
              {t.calendar.today}
            </button>
            <button type="button" onClick={() => move(1)} className={buttonSecondary} aria-label={t.calendar.next}>
              →
            </button>
            <h2 className="ml-2 text-[16px] font-bold" aria-live="polite">
              {title}
            </h2>
          </div>
          <Segmented label={t.calendar.title} value={view} onChange={setView} options={(["month", "week", "day"] as const).map((v) => ({ value: v, label: t.calendar.views[v] }))} />
        </div>
        <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} onRetry={data.reload}>
          {body}
        </LoadState>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[12px] text-muted" aria-label={t.calendar.legend}>
          {kinds.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: calendarColor[k] }} />
              {t.calendarKind[k]}
            </li>
          ))}
          <li>
            <Badge tone="danger">{t.calendar.overdue}</Badge>
          </li>
          <li>⚠ {t.calendar.overlap}</li>
        </ul>
      </Card>
    </>
  );
}
