"use client";

import { useRef, useState } from "react";
import {
  ConsentField,
  FieldError,
  FormReview,
  HoneypotField,
  Opt,
  RadioCards,
  TextField,
  copyRows,
  emailPattern,
  inputClass,
  showHeading,
} from "@/components/forms/FormParts";
import {
  budgetRanges,
  performanceDatesMax,
  performanceEnsembles,
  scheduleModes,
  timeSlots,
  type BudgetRange,
  type PerformanceEnsemble,
  type ScheduleMode,
  type TimeSlot,
} from "@/data/orders/performance";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { jaOrEn, localizedPath, type Locale } from "@/lib/i18n";
import { submitPerformanceQuote, withReceipt, type SubmitResult } from "@/lib/orders/submit";

type Step = "edit" | "confirm" | "done";
type DateRow = { date: string; slot: TimeSlot; time: string };
type ErrorKey = "schedule" | "dates" | "budget" | "ensemble" | "name" | "email" | "consent";

const emptyDate: DateRow = { date: "", slot: "any", time: "" };

// 演奏依頼の見積もりフォーム（PR #24 §1）。
// 主な項目は「日程」「予算範囲」「編成」「備考」。返信のために氏名とメールアドレスも伺う。
// 価格の自動確定・自動請求はしない。送信先が未設定の間は「まだ届いていない」と明示する
export default function PerformanceQuoteForm({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.performanceQuote;
  const f = dict.forms;

  const [step, setStep] = useState<Step>("edit");
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [mode, setMode] = useState<ScheduleMode | null>(null);
  const [dates, setDates] = useState<DateRow[]>([{ ...emptyDate }]);
  const [period, setPeriod] = useState(""); // 日程が未定のときの時期の目安
  const [budget, setBudget] = useState<BudgetRange | null>(null);
  const [ensemble, setEnsemble] = useState<PerformanceEnsemble | null>(null);
  const [instruments, setInstruments] = useState("");
  const [remarks, setRemarks] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState(""); // ハニーポット

  const headingRef = useRef<HTMLHeadingElement>(null);

  const filledDates = dates.filter((d) => d.date);
  const errors: Partial<Record<ErrorKey, string>> = {};
  if (!mode) errors.schedule = t.errors.schedule;
  if (mode && mode !== "undecided" && filledDates.length === 0) errors.dates = t.errors.dates;
  if (!budget) errors.budget = t.errors.budget;
  if (!ensemble) errors.ensemble = t.errors.ensemble;
  if (!name.trim()) errors.name = f.errors.name;
  if (!emailPattern.test(email.trim())) errors.email = f.errors.email;
  if (!consent) errors.consent = f.errors.consent;
  const hasErrors = Object.keys(errors).length > 0;
  const err = (k: ErrorKey) => showErrors && errors[k];

  function setMode2(next: ScheduleMode) {
    setMode(next);
    // 「決まっている」は 1 日だけにする
    if (next === "fixed") setDates((d) => [d[0] ?? { ...emptyDate }]);
  }

  function updateDate(i: number, patch: Partial<DateRow>) {
    setDates((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  function dateText(d: DateRow): string {
    const slot = d.slot === "any" ? "" : ` ${t.schedule.slots[d.slot]}`;
    const time = d.time.trim() ? ` ${d.time.trim()}` : "";
    return `${d.date}${slot}${time}`;
  }

  function rows(): [string, string][] {
    const detail = mode === "undecided" ? period.trim() : filledDates.map(dateText).join("\n");
    return [
      [t.schedule.heading, [mode ? t.schedule.modes[mode] : "", detail].filter(Boolean).join("\n")],
      [t.budget.heading, budget ? t.budget.options[budget] : ""],
      [t.ensemble.heading, [ensemble ? t.ensemble.options[ensemble] : "", instruments.trim()].filter(Boolean).join(" / ")],
      [t.remarks.heading, remarks.trim() || "—"],
      [f.name, name.trim()],
      [f.email, email.trim()],
    ];
  }

  function payload() {
    return {
      kind: "performance_quote",
      locale,
      schedule: { mode, dates: mode === "undecided" ? [] : filledDates, period: mode === "undecided" ? period.trim() : "" },
      budget,
      ensemble,
      instruments: instruments.trim(),
      remarks: remarks.trim(),
      contact: { name: name.trim(), email: email.trim() },
      consent,
    };
  }

  function goReview(event: React.FormEvent) {
    event.preventDefault();
    if (hasErrors) {
      setShowErrors(true);
      // 最初のエラーの位置へ
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true'], [data-error='true']")?.scrollIntoView({ block: "center" }));
      return;
    }
    setStep("confirm");
    requestAnimationFrame(() => showHeading(headingRef.current));
  }

  async function handleSubmit() {
    setSubmitting(true);
    // ハニーポットに入力があれば自動投稿とみなし、送らない
    const r: SubmitResult = trap ? { status: "error", message: "rejected" } : await submitPerformanceQuote(payload());
    setSubmitting(false);
    setResult(r);
    setStep("done");
    requestAnimationFrame(() => showHeading(headingRef.current));
  }

  if (step !== "edit") {
    const title = step === "confirm" ? t.confirm.heading : result?.status === "sent" ? t.result.sentTitle : result?.status === "error" ? f.result.errorTitle : f.result.notConnectedTitle;
    const body = step === "confirm" ? t.confirm.lead : result?.status === "sent" ? withReceipt(t.result.sentBody, result, f.result.receiptNote) : result?.status === "error" ? f.result.errorBody : f.result.notConnectedBody;
    return (
      <FormReview
        step={step}
        title={title}
        body={body}
        warn={step === "done" && result?.status !== "sent"}
        rows={rows()}
        note={t.note}
        labels={{ submit: t.submit, submitting: f.submitting, back: f.back, copy: f.copy, copied: f.copied }}
        submitting={submitting}
        copied={copied}
        showCopy={result?.status !== "sent"}
        headingRef={headingRef}
        onSubmit={handleSubmit}
        onBack={() => {
          setStep("edit");
          setResult(null);
          setCopied(false);
        }}
        onCopy={async () => setCopied(await copyRows(rows()))}
      />
    );
  }

  const labels = { required: f.required, optional: f.optional };

  return (
    <form onSubmit={goReview} noValidate className="relative grid gap-6">
      <HoneypotField value={trap} onChange={setTrap} label={f.honeypot} />

      {/* 日程 */}
      <section className="grid min-w-0 gap-4 rounded-card border border-line bg-card p-5 sm:p-6" data-error={!!err("schedule") || !!err("dates") || undefined}>
        <RadioCards
          name="schedule"
          legend={t.schedule.heading}
          options={scheduleModes.map((m) => ({ value: m, label: t.schedule.modes[m] }))}
          value={mode}
          onChange={setMode2}
          labels={labels}
          required
          error={err("schedule")}
        />
        {mode && mode !== "undecided" && (
          <div className="grid gap-3">
            {dates.map((d, i) => (
              <div key={i} className="grid gap-3 rounded-control border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="min-w-0">
                  <label htmlFor={`pd-date-${i}`} className="text-[13px] font-bold">
                    {mode === "candidates" ? t.schedule.candidate(i + 1) : t.schedule.date}
                  </label>
                  <input id={`pd-date-${i}`} type="date" value={d.date} onChange={(e) => updateDate(i, { date: e.target.value })} aria-invalid={i === 0 && !!err("dates")} aria-describedby={i === 0 && err("dates") ? "err-dates" : undefined} className={`${inputClass} mt-1`} />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`pd-slot-${i}`} className="text-[13px] font-bold">
                    {t.schedule.slot}
                  </label>
                  <select id={`pd-slot-${i}`} value={d.slot} onChange={(e) => updateDate(i, { slot: e.target.value as TimeSlot })} className={`${inputClass} mt-1`}>
                    {timeSlots.map((s) => (
                      <option key={s} value={s}>
                        {t.schedule.slots[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`pd-time-${i}`} className="text-[13px] font-bold">
                    {t.schedule.time} <Opt t={f.optional} />
                  </label>
                  <input id={`pd-time-${i}`} type="text" value={d.time} maxLength={40} placeholder={t.schedule.timePlaceholder} onChange={(e) => updateDate(i, { time: e.target.value })} className={`${inputClass} mt-1`} />
                </div>
                {mode === "candidates" && dates.length > 1 ? (
                  <button type="button" onClick={() => setDates((prev) => prev.filter((_, j) => j !== i))} className="h-[46px] rounded-button border border-muted bg-card px-3 text-[13px] hover:bg-subtle">
                    {t.schedule.remove}
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            ))}
            <FieldError id="err-dates" text={err("dates")} />
            {mode === "candidates" && dates.length < performanceDatesMax && (
              <button type="button" onClick={() => setDates((prev) => [...prev, { ...emptyDate }])} className="justify-self-start rounded-button border border-navy bg-card px-4 py-2 text-[14px] text-navy hover:bg-subtle">
                ＋ {t.schedule.add}
              </button>
            )}
          </div>
        )}
        {mode === "undecided" && (
          <TextField id="pd-period" label={t.schedule.period} value={period} onChange={setPeriod} labels={labels} placeholder={t.schedule.periodPlaceholder} maxLength={100} />
        )}
      </section>

      {/* 予算範囲 */}
      <section className="min-w-0 rounded-card border border-line bg-card p-5 sm:p-6" data-error={!!err("budget") || undefined}>
        <RadioCards
          name="budget"
          legend={t.budget.heading}
          options={budgetRanges.map((b) => ({ value: b, label: t.budget.options[b] }))}
          value={budget}
          onChange={setBudget}
          labels={labels}
          required
          error={err("budget")}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.budget.note}</p>
      </section>

      {/* 編成 */}
      <section className="grid min-w-0 gap-4 rounded-card border border-line bg-card p-5 sm:p-6" data-error={!!err("ensemble") || undefined}>
        <RadioCards
          name="ensemble"
          legend={t.ensemble.heading}
          options={performanceEnsembles.map((e) => ({ value: e, label: t.ensemble.options[e], note: t.ensemble.notes[e] }))}
          value={ensemble}
          onChange={setEnsemble}
          labels={labels}
          required
          error={err("ensemble")}
          columns="grid-cols-2 sm:grid-cols-5"
        />
        <TextField id="pd-instruments" label={t.ensemble.instruments} value={instruments} onChange={setInstruments} labels={labels} placeholder={t.ensemble.instrumentsPlaceholder} maxLength={200} />
      </section>

      {/* 備考 */}
      <section className="min-w-0 rounded-card border border-line bg-card p-5 sm:p-6">
        <label htmlFor="pd-remarks" className="text-[15px] font-bold">
          {t.remarks.heading} <Opt t={f.optional} />
        </label>
        <p className="mt-1 text-[12px] text-muted">{t.remarks.help}</p>
        <textarea id="pd-remarks" rows={5} maxLength={3000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t.remarks.placeholder} className={`${inputClass} mt-2`} />
      </section>

      {/* 連絡先 */}
      <section className="grid min-w-0 gap-4 rounded-card border border-line bg-card p-5 sm:grid-cols-2 sm:p-6">
        <h2 className="text-[15px] font-bold sm:col-span-2">{f.contactHeading}</h2>
        <TextField id="pd-name" label={f.name} value={name} onChange={setName} required labels={labels} error={err("name")} autoComplete="name" />
        <TextField id="pd-email" type="email" label={f.email} value={email} onChange={setEmail} required labels={labels} error={err("email")} autoComplete="email" />
        <div className="sm:col-span-2">
          <ConsentField id="pd-consent" checked={consent} onChange={setConsent} text={f.consent} privacyLabel={f.privacyLink} privacyHref={localizedPath(locale, pagePaths.privacy)} error={err("consent")} locale={jaOrEn(locale)} />
        </div>
      </section>

      <div className="grid gap-3 sm:flex sm:items-center">
        <button type="submit" className="rounded-button bg-navy px-6 py-3.5 text-[15px] font-bold text-white hover:brightness-110">
          {t.review}
        </button>
        <p className="text-[12px] leading-relaxed text-muted">{t.note}</p>
      </div>
      {showErrors && hasErrors && (
        <p role="alert" className="rounded-control border border-navy bg-subtle p-3 text-[14px] font-bold">
          {f.fixErrors}
        </p>
      )}
    </form>
  );
}
