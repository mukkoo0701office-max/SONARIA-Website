"use client";

// 申込・問い合わせフォームの共通部品（演奏依頼の見積もり・講師登録で使う）。
// 文言は呼び出し側が辞書から渡す。部品は文言を持たない

import Link from "next/link";
import type { RefObject } from "react";

// 入力欄の枠は 3:1 以上のコントラストが必要（WCAG 1.4.11）。border-line（1.32:1）ではなく border-muted を使う
export const inputClass = "w-full rounded-control border border-muted bg-card p-[12px] text-[15px] text-ink";
export const optionBase =
  "flex cursor-pointer items-start gap-3 rounded-control border p-3 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy";
export const optionOn = "border-navy bg-navy/5";
export const optionOff = "border-muted bg-card hover:bg-subtle";
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormLabels = { required: string; optional: string };

export function Req({ t }: { t: string }) {
  return <span className="ml-1 rounded-tag bg-navy px-1.5 py-0.5 align-middle text-[11px] font-normal text-white">{t}</span>;
}

export function Opt({ t }: { t: string }) {
  return <span className="ml-1 rounded-tag border border-muted px-1.5 py-0.5 align-middle text-[11px] font-normal text-muted">{t}</span>;
}

export function FieldError({ id, text }: { id: string; text?: string | false }) {
  if (!text) return null;
  return (
    <p id={id} className="mt-2 text-[13px] font-bold text-ink">
      ⚠ {text}
    </p>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  required,
  labels,
  error,
  type = "text",
  autoComplete,
  placeholder,
  maxLength = 200,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  labels: FormLabels;
  error?: string | false;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  help?: string;
}) {
  const describedBy = [help ? `help-${id}` : null, error ? `err-${id}` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[14px] font-bold">
        {label} {required ? <Req t={labels.required} /> : <Opt t={labels.optional} />}
      </label>
      {help && (
        <p id={`help-${id}`} className="mt-1 text-[12px] text-muted">
          {help}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-2`}
      />
      <FieldError id={`err-${id}`} text={error} />
    </div>
  );
}

/** ラジオボタンのカード列 */
export function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  labels,
  required,
  error,
  columns = "sm:grid-cols-3",
}: {
  name: string;
  legend: string;
  options: { value: T; label: string; note?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  labels: FormLabels;
  required?: boolean;
  error?: string | false;
  columns?: string;
}) {
  return (
    <fieldset className="min-w-0" aria-describedby={error ? `err-${name}` : undefined}>
      <legend className="text-[15px] font-bold">
        {legend} {required ? <Req t={labels.required} /> : <Opt t={labels.optional} />}
      </legend>
      <div className={`mt-3 grid gap-2 ${columns}`}>
        {options.map((o) => (
          <label key={o.value} className={`${optionBase} ${value === o.value ? optionOn : optionOff}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 accent-navy" />
            <span>
              <span className="block font-bold">{o.label}</span>
              {o.note && <span className="block text-[12px] text-muted">{o.note}</span>}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`err-${name}`} text={error} />
    </fieldset>
  );
}

/** チェックボックスのカード列（複数選択） */
export function CheckCards<T extends string>({
  name,
  legend,
  options,
  values,
  onChange,
  labels,
  required,
  error,
  help,
  columns = "grid-cols-2 sm:grid-cols-4",
}: {
  name: string;
  legend: string;
  options: { value: T; label: string }[];
  values: readonly T[];
  onChange: (v: T[]) => void;
  labels: FormLabels;
  required?: boolean;
  error?: string | false;
  help?: string;
  columns?: string;
}) {
  return (
    <fieldset className="min-w-0" aria-describedby={error ? `err-${name}` : undefined}>
      <legend className="text-[15px] font-bold">
        {legend} {required ? <Req t={labels.required} /> : <Opt t={labels.optional} />}
      </legend>
      {help && <p className="mt-1 text-[12px] text-muted">{help}</p>}
      <div className={`mt-3 grid gap-2 ${columns}`}>
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <label key={o.value} className={`${optionBase} ${on ? optionOn : optionOff}`}>
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
                className="mt-0.5 accent-navy"
              />
              <span className="font-bold">{o.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={`err-${name}`} text={error} />
    </fieldset>
  );
}

/** 同意のチェックボックス（プライバシーポリシーへのリンク付き） */
export function ConsentField({
  id,
  checked,
  onChange,
  text,
  privacyLabel,
  privacyHref,
  error,
  locale,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
  privacyLabel?: string;
  privacyHref?: string;
  error?: string | false;
  locale: "ja" | "en";
}) {
  return (
    <div>
      <label className="flex items-start gap-2 text-[14px]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `err-${id}` : undefined}
          className="mt-1 h-4 w-4 accent-navy"
        />
        <span>
          {text}
          {privacyLabel && privacyHref && (
            <>
              {locale === "ja" ? "（" : " ("}
              <Link href={privacyHref} className="underline" target="_blank">
                {privacyLabel}
              </Link>
              {locale === "ja" ? "）" : ")"}
            </>
          )}
        </span>
      </label>
      <FieldError id={`err-${id}`} text={error} />
    </div>
  );
}

/**
 * スパム対策の見えない入力欄（ハニーポット）。人には見えず、自動投稿のプログラムだけが入力する。
 * 値が入っていたら送信しない（受付完了の表示だけ出す）
 */
export function HoneypotField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
      <label>
        {label}
        <input type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export type ReviewLabels = {
  submit: string;
  submitting: string;
  back: string;
  copy: string;
  copied: string;
};

/** 確認画面・送信結果の画面 */
export function FormReview({
  step,
  title,
  body,
  warn,
  rows,
  note,
  labels,
  submitting,
  copied,
  showCopy,
  headingRef,
  onSubmit,
  onBack,
  onCopy,
}: {
  step: "confirm" | "done";
  title: string;
  body: string;
  warn: boolean;
  rows: [string, string][];
  note?: string;
  labels: ReviewLabels;
  submitting: boolean;
  copied: boolean;
  showCopy: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSubmit: () => void;
  onBack: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="mx-auto max-w-content">
      <div className={`rounded-card border p-6 ${warn ? "border-navy bg-subtle" : "border-line bg-card"}`} role={step === "done" ? "status" : undefined}>
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-6 text-xl font-bold">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed">{body}</p>
      </div>
      <dl className="mt-6 grid gap-0 rounded-card border border-line bg-card p-5 text-[14px]">
        {rows.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="grid gap-1 border-b border-line py-2 last:border-b-0 sm:grid-cols-[200px_1fr]">
            <dt className="text-muted">{k}</dt>
            <dd className="whitespace-pre-wrap break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-[12px] leading-relaxed text-muted">{note}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {step === "confirm" ? (
          <>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="rounded-button bg-navy px-5 py-3 text-[15px] font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? labels.submitting : labels.submit}
            </button>
            <button type="button" onClick={onBack} className="rounded-button border border-navy bg-card px-5 py-3 text-[15px] text-navy hover:bg-subtle">
              {labels.back}
            </button>
          </>
        ) : (
          <>
            {showCopy && (
              <button type="button" onClick={onCopy} className="rounded-button bg-navy px-5 py-3 text-[15px] font-bold text-white hover:brightness-110">
                {copied ? labels.copied : labels.copy}
              </button>
            )}
            <button type="button" onClick={onBack} className="rounded-button border border-navy bg-card px-5 py-3 text-[15px] text-navy hover:bg-subtle">
              {labels.back}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** 画面が切り替わったとき（確認・結果）に見出しを画面の上端に出し、フォーカスを移す（スクリーンリーダーにも伝わる） */
export function showHeading(el: HTMLElement | null) {
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}

/** 入力内容をクリップボードにコピーする（送信できなかったときの控え） */
export async function copyRows(rows: [string, string][]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(rows.map(([k, v]) => `${k}: ${v}`).join("\n"));
    return true;
  } catch {
    return false;
  }
}
