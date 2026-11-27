"use client";

// 管理画面の共通部品。サイトのデザイントークン（navy・paper・card・line・muted・ink）に合わせる

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAdmin } from "./AdminContext";
import { toneClass, type Tone } from "./theme";

export const adminRoutes = {
  login: "/admin/",
  dashboard: "/admin/dashboard/",
  inquiries: "/admin/inquiries/",
  inquiry: (id: string) => `/admin/inquiries/detail/?id=${encodeURIComponent(id)}`,
  calendar: "/admin/calendar/",
  teachers: "/admin/teachers/",
  revenue: "/admin/revenue/",
  analytics: "/admin/analytics/",
  pdf: "/admin/pdf/",
  notifications: "/admin/notifications/",
} as const;

export const inputClass = "w-full rounded-control border border-muted bg-card px-3 py-2 text-[14px] text-ink";
export const buttonPrimary = "rounded-button bg-navy px-4 py-2 text-[14px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonSecondary = "rounded-button border border-navy bg-card px-4 py-2 text-[14px] text-navy hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50";
export const buttonDanger = "rounded-button border border-[#8a1c1c] bg-card px-4 py-2 text-[14px] text-[#8a1c1c] hover:bg-[#fdeeee]";

export function PageTitle({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {lead && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", id }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className={`min-w-0 rounded-card border border-line bg-card p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 id={id} className="text-[15px] font-bold">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold ${toneClass[tone]}`}>{children}</span>;
}

export function NotConnected({ children }: { children?: React.ReactNode }) {
  const { t } = useAdmin();
  return (
    <p className="flex items-start gap-2 rounded-control border border-dashed border-muted bg-paper p-3 text-[12px] leading-relaxed text-muted">
      <Badge tone="warn">{t.common.notConnected}</Badge>
      <span>{children}</span>
    </p>
  );
}

/** 指標のタイル（数値を主役にした小さなカード） */
export function StatTile({ label, value, sub, tone, href }: { label: string; value: string; sub?: React.ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
      {tone && tone !== "neutral" && <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${tone === "danger" ? "bg-[#dc3c3d]" : tone === "warn" ? "bg-[#f2a600]" : tone === "good" ? "bg-[#0aac23]" : "bg-[#257de0]"}`} aria-hidden="true" />}
    </>
  );
  const cls = "relative block min-w-0 rounded-card border border-line bg-card p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** 切り替えボタンの組（タブ・期間・表示形式） */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-full border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-[13px] ${value === o.value ? "bg-navy font-semibold text-white" : "text-ink hover:bg-subtle"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 読み込み中・エラー・空の表示 */
export function LoadState({ status, empty, onRetry, children }: { status: "loading" | "ready" | "error"; empty?: boolean; onRetry?: () => void; children: React.ReactNode }) {
  const { t } = useAdmin();
  if (status === "loading")
    return (
      <div role="status" className="grid gap-2 py-6" aria-label={t.common.loading}>
        <div className="h-4 w-1/3 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
        <span className="sr-only">{t.common.loading}</span>
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-control border border-[#f2a7a7] bg-[#fdeeee] p-3 text-[13px]">
        {t.common.error}
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-3 underline">
            {t.common.retry}
          </button>
        )}
      </div>
    );
  if (empty) return <p className="py-6 text-center text-[13px] text-muted">{t.common.empty}</p>;
  return <>{children}</>;
}

/** モーダル（ネイティブの dialog 要素。Esc で閉じる・フォーカスを閉じ込める） */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useAdmin();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="admin-modal-title" className="w-[min(640px,92vw)] rounded-card border border-line bg-card p-0 text-ink backdrop:bg-ink/40">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="admin-modal-title" className="text-[15px] font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="rounded-button px-2 py-1 text-[13px] hover:bg-subtle">
          {t.common.close}
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

/** 表（横にはみ出す場合は表だけスクロール） */
export function Table({ head, children, caption }: { head: React.ReactNode; children: React.ReactNode; caption?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line text-[12px] text-muted">{head}</thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/** 期限までの日数（負なら超過） */
export function daysUntil(iso: string | undefined, today = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((d0.getTime() - t0.getTime()) / 86_400_000);
}
