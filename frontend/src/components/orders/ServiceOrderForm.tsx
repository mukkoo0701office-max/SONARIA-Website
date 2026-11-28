"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  bowingPagesMax,
  bowingUnitPrice,
  deliveryOptions,
  lessonCandidateDays,
  lessonCandidatesMax,
  lessonDayEnd,
  lessonPlans,
  lessonStartTimes,
  lessonTimeZone,
  recordingInstruments,
  recordingTracksMax,
  services,
  taxNotePending,
  type BowingType,
  type DeliveryId,
  type LessonPlanId,
  type RecordingInstrument,
  type ServiceId,
} from "@/data/orders/config";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { jaOrEn, localizedPath, type Locale } from "@/lib/i18n";
import { clampInt, quoteBowing, quoteRecording } from "@/lib/orders/pricing";
import { candidateDays, endsAfter, isPast, validCandidates, type Candidate, type CandidateDay } from "@/lib/orders/schedule";
import { submitOrder, withReceipt, type SubmitResult } from "@/lib/orders/submit";

type Props = { locale: Locale };
type Step = "edit" | "confirm" | "done";
type Errors = Partial<Record<"trial" | "plan" | "candidates" | "tracks" | "name" | "email" | "consent", string>>;
type Line = { label: string; amount: number };

const yen = (n: number) => `¥${n.toLocaleString("en-US")}`;
const factorText = (tenths: number) => (tenths / 10).toFixed(1);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 入力欄の枠は 3:1 以上のコントラストが必要（WCAG 1.4.11）。border-line（1.32:1）ではなく border-muted を使う
const inputClass = "w-full rounded-control border border-muted bg-card p-[12px] text-[15px] text-ink";
const optionBase = "flex cursor-pointer items-start gap-3 rounded-control border p-3 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy";
const optionOn = "border-navy bg-navy/5";
const optionOff = "border-muted bg-card hover:bg-subtle";

// SONARIA 運営サービス（レッスン／運指・運弓付け／録音）の統合申込フォーム（Issue #13）。
// 料金・受付条件は data/orders/config.ts、計算は lib/orders/*。送信先が未設定の間は「未接続」と明示する
export default function ServiceOrderForm({ locale }: Props) {
  const dict = getDictionary(locale);
  const t = dict.orderForm;

  const [service, setService] = useState<ServiceId>("lesson");
  const [step, setStep] = useState<Step>("edit");
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // レッスン
  const [trialTaken, setTrialTaken] = useState<"yes" | "no" | null>(null);
  const [plan, setPlan] = useState<LessonPlanId | null>(null);
  const [now, setNow] = useState<Date | null>(null); // 静的書き出しのため、日付は閲覧時（ブラウザ）に作る
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // 運指・運弓
  const [bowingType, setBowingType] = useState<BowingType>("both");
  const [pages, setPages] = useState(1);
  const [score, setScore] = useState("");

  // 録音
  const [tracks, setTracks] = useState<Record<RecordingInstrument, number>>({ violin: 0, viola: 0, cello: 0, other: 0 });
  const [otherDetail, setOtherDetail] = useState("");

  // 納期（運指・運弓／録音で別々に持つ）
  const [delivery, setDelivery] = useState<Record<"bowing" | "recording", DeliveryId>>({ bowing: "threePlus", recording: "threePlus" });

  // 共通
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [remarks, setRemarks] = useState("");
  const [consent, setConsent] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // URL のクエリから初期値を受け取る（?service=bowing&title=…&composer=…&part=… は楽譜ページの運弓バナーから）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("service");
    if (s && (services as readonly string[]).includes(s)) setService(s as ServiceId);
    const parts = q.getAll("part").filter(Boolean);
    const prefill = [q.get("composer"), q.get("title"), parts.length ? `(${parts.join(", ")})` : null].filter(Boolean).join(" ");
    if (prefill) setScore(prefill.slice(0, 200));
    setNow(new Date());
  }, []);

  // 選んだサービスを URL に残す（共有・戻る操作のため。履歴は増やさない）
  function selectService(next: ServiceId) {
    setService(next);
    setShowErrors(false);
    const url = new URL(window.location.href);
    url.searchParams.set("service", next);
    window.history.replaceState(null, "", url);
  }

  const days: CandidateDay[] = useMemo(() => (now ? candidateDays(now, lessonCandidateDays, lessonTimeZone) : []), [now]);
  const planInfo = lessonPlans.find((p) => p.id === plan) ?? null;
  const deliveryOf = (id: DeliveryId) => deliveryOptions.find((o) => o.id === id) ?? deliveryOptions[deliveryOptions.length - 1];

  const bowingQuote = quoteBowing(bowingType, pages, bowingUnitPrice, deliveryOf(delivery.bowing));
  const recordingQuote = quoteRecording(recordingInstruments, tracks, deliveryOf(delivery.recording));
  const valid = now ? validCandidates(candidates, days.map((d) => d.date), lessonStartTimes, now, lessonTimeZone) : [];

  // 明細（小計 → 基本料金 → 納期係数 → 合計）
  const summary = useMemo((): { lines: Line[]; base: number | null; factor: number | null; total: number | null } => {
    if (service === "lesson") {
      if (!planInfo) return { lines: [], base: null, factor: null, total: null };
      return { lines: [{ label: t.summary.lineLesson(t.lesson.plans[planInfo.id]), amount: planInfo.price }], base: null, factor: null, total: planInfo.price };
    }
    if (service === "bowing") {
      const lines: Line[] = [{ label: t.summary.lineBowing(t.bowing.types[bowingType], yen(bowingQuote.unitPrice), pages), amount: bowingQuote.base }];
      return { lines, base: bowingQuote.base, factor: deliveryOf(delivery.bowing).factorTenths, total: bowingQuote.total };
    }
    if (recordingQuote.lines.length === 0) return { lines: [], base: null, factor: null, total: null };
    const lines = recordingQuote.lines.map((l) => ({
      label: t.summary.lineTrack(`${t.recording.instruments[l.id as RecordingInstrument]}${l.outsourced ? `（${t.recording.outsourced}）` : ""}`, yen(l.unitPrice), l.tracks),
      amount: l.subtotal,
    }));
    return { lines, base: recordingQuote.base, factor: deliveryOf(delivery.recording).factorTenths, total: recordingQuote.total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, planInfo, bowingType, pages, tracks, delivery, locale]);

  const errors: Errors = {};
  if (service === "lesson") {
    if (!trialTaken) errors.trial = t.lesson.trialQuestion;
    if (!plan) errors.plan = t.lesson.plan;
    if (valid.length === 0) errors.candidates = t.lesson.noCandidates;
  }
  if (service === "recording" && recordingQuote.tracks === 0) errors.tracks = t.recording.noTracks;
  if (!name.trim()) errors.name = t.common.nameRequired;
  if (!emailPattern.test(email.trim())) errors.email = t.common.emailInvalid;
  if (!consent) errors.consent = t.common.consentRequired;
  const hasErrors = Object.keys(errors).length > 0;
  const err = (k: keyof Errors) => (showErrors ? errors[k] : undefined);

  function toggleCandidate(date: string, time: string) {
    setCandidates((list) => {
      const exists = list.some((c) => c.date === date && c.time === time);
      if (exists) return list.filter((c) => !(c.date === date && c.time === time));
      if (list.length >= lessonCandidatesMax) return list;
      return [...list, { date, time }];
    });
  }

  function moveCandidate(index: number, delta: number) {
    setCandidates((list) => {
      const next = [...list];
      const j = index + delta;
      if (j < 0 || j >= next.length) return list;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function chooseTrial(value: "yes" | "no") {
    setTrialTaken(value);
    if (value === "yes" && plan === "trial") setPlan(null); // 受講済みなら体験は選べない
  }

  function dayText(date: string) {
    const d = days.find((x) => x.date === date);
    const [, m, dd] = date.split("-").map(Number);
    return t.lesson.dayLabel(m, dd, t.lesson.weekdays[d?.weekday ?? new Date(`${date}T00:00:00Z`).getUTCDay()]);
  }

  // 確認画面・コピー用の内容（ラベルと値の組）
  function reviewRows(): [string, string][] {
    const rows: [string, string][] = [[t.tabsLabel, t.tabs[service]]];
    if (service === "lesson") {
      rows.push([t.lesson.trialQuestion, trialTaken === "yes" ? t.lesson.trialYes : t.lesson.trialNo]);
      if (planInfo) rows.push([t.lesson.plan, `${t.lesson.plans[planInfo.id]} ${yen(planInfo.price)}`]);
      valid.forEach((c, i) => rows.push([t.lesson.priority(i + 1), `${dayText(c.date)} ${c.time}`]));
    }
    if (service === "bowing") {
      rows.push([t.bowing.type, t.bowing.types[bowingType]], [t.bowing.pages, String(pages)]);
      if (score.trim()) rows.push([t.bowing.score, score.trim()]);
      rows.push([t.delivery.heading, t.delivery.options[delivery.bowing]]);
    }
    if (service === "recording") {
      recordingQuote.lines.forEach((l) => rows.push([t.recording.instruments[l.id as RecordingInstrument], `${l.tracks}`]));
      if (tracks.other > 0 && otherDetail.trim()) rows.push([t.recording.otherDetail, otherDetail.trim()]);
      rows.push([t.delivery.heading, t.delivery.options[delivery.recording]]);
    }
    if (summary.total != null) rows.push([t.summary.total, yen(summary.total)]);
    rows.push([t.common.name, name.trim()], [t.common.email, email.trim()]);
    if (remarks.trim()) rows.push([t.common.remarks, remarks.trim()]);
    return rows;
  }

  function payload() {
    return {
      service,
      // 受付関数・DB は返信言語として ja / en だけを受け付ける。欧州 4 言語のページからは en で送り、表示していた言語は pageLocale に残す
      locale: jaOrEn(locale),
      pageLocale: locale,
      createdAt: new Date().toISOString(),
      estimateTotal: summary.total,
      lesson: service === "lesson" ? { trialTaken, plan, candidates: valid } : undefined,
      bowing: service === "bowing" ? { type: bowingType, pages, score: score.trim(), delivery: delivery.bowing } : undefined,
      recording: service === "recording" ? { tracks, otherDetail: tracks.other > 0 ? otherDetail.trim() : "", delivery: delivery.recording } : undefined,
      customer: { name: name.trim(), email: email.trim(), remarks: remarks.trim() },
    };
  }

  function goReview(event: React.FormEvent) {
    event.preventDefault();
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setStep("confirm");
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function handleSubmit() {
    setSubmitting(true);
    const r = await submitOrder(payload());
    setSubmitting(false);
    setResult(r);
    setStep("done");
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function copyText() {
    const text = reviewRows().map(([k, v]) => `${k}: ${v}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function onTabKey(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = services[(index + (event.key === "ArrowRight" ? 1 : services.length - 1)) % services.length];
    selectService(next);
    tabRefs.current[next]?.focus();
  }

  const summaryCard = (
    <section aria-labelledby="order-summary" className="rounded-card border border-line bg-card p-5 lg:sticky lg:top-6">
      <h2 id="order-summary" className="text-base font-bold">{t.summary.heading}</h2>
      {summary.total == null ? (
        <p className="mt-3 text-[14px] text-muted">{t.summary.empty}</p>
      ) : (
        <dl className="mt-3 grid gap-2 text-[14px]" aria-live="polite">
          {summary.lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-3">
              <dt>{l.label}</dt>
              <dd className="shrink-0 tabular-nums">{yen(l.amount)}</dd>
            </div>
          ))}
          {summary.base != null && summary.factor != null && (
            <>
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt>{t.summary.base}</dt>
                <dd className="tabular-nums">{yen(summary.base)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t.summary.deliveryFactor}</dt>
                <dd className="tabular-nums">{t.delivery.factor(factorText(summary.factor))}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-3 border-t border-navy pt-2 text-lg font-bold">
            <dt>{t.summary.total}</dt>
            <dd className="tabular-nums">{yen(summary.total)}</dd>
          </div>
        </dl>
      )}
      {service === "bowing" && bowingType === "both" && (
        <p className="mt-2 text-[13px] text-muted">{t.bowing.setDeal(yen(bowingQuote.listUnitPrice), yen(bowingQuote.unitPrice), yen(bowingQuote.setDiscountPerPage))}</p>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-muted">{t.estimateNote}</p>
      {taxNotePending && <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.taxNote}</p>}
    </section>
  );

  // ---- 確認・結果 ----------------------------------------------------------
  if (step !== "edit") {
    const rows = reviewRows();
    const title =
      step === "confirm" ? t.confirm.heading : result?.status === "sent" ? t.result.sentTitle : result?.status === "error" ? t.result.errorTitle : t.result.notConnectedTitle;
    const body =
      step === "confirm" ? t.confirm.lead : result?.status === "sent" ? withReceipt(t.result.sentBody, result, dict.forms.result.receiptNote) : result?.status === "error" ? t.result.errorBody : t.result.notConnectedBody;
    const warn = step === "done" && result?.status !== "sent";
    return (
      <div className="mx-auto max-w-content">
        <div className={`rounded-card border p-6 ${warn ? "border-navy bg-subtle" : "border-line bg-card"}`} role={step === "done" ? "status" : undefined}>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold">{title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed">{body}</p>
        </div>
        <dl className="mt-6 grid gap-0 rounded-card border border-line bg-card p-5 text-[14px]">
          {rows.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="grid gap-1 border-b border-line py-2 last:border-b-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-muted">{k}</dt>
              <dd className="whitespace-pre-wrap break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-muted">{service === "lesson" ? t.lesson.notBooking : t.estimateNote}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {step === "confirm" ? (
            <>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-button bg-navy px-5 py-3 text-[15px] font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? t.actions.submitting : t.actions.submit}
              </button>
              <button type="button" onClick={() => setStep("edit")} className="rounded-button border border-navy bg-card px-5 py-3 text-[15px] text-navy hover:bg-subtle">
                {t.actions.back}
              </button>
            </>
          ) : (
            <>
              {result?.status !== "sent" && (
                <button type="button" onClick={copyText} className="rounded-button bg-navy px-5 py-3 text-[15px] font-bold text-white hover:brightness-110">
                  {copied ? t.actions.copied : t.actions.copy}
                </button>
              )}
              <button type="button" onClick={() => { setStep("edit"); setResult(null); setCopied(false); }} className="rounded-button border border-navy bg-card px-5 py-3 text-[15px] text-navy hover:bg-subtle">
                {t.actions.back}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- 入力 ----------------------------------------------------------------
  return (
    <form onSubmit={goReview} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* fieldset の既定 min-inline-size: min-content で横スクロール行がページ幅を広げないよう min-w-0 を付ける */}
      <div className="grid min-w-0 gap-6">
        <div role="tablist" aria-label={t.tabsLabel} className="grid grid-cols-3 gap-1 rounded-card border border-line bg-card p-1">
          {services.map((s, i) => (
            <button
              key={s}
              ref={(el) => { tabRefs.current[s] = el; }}
              type="button"
              role="tab"
              id={`tab-${s}`}
              aria-selected={service === s}
              aria-controls="order-panel"
              tabIndex={service === s ? 0 : -1}
              onClick={() => selectService(s)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={service === s ? "rounded-button bg-navy px-2 py-2.5 text-[13px] font-bold text-white sm:text-[15px]" : "rounded-button px-2 py-2.5 text-[13px] text-ink hover:bg-subtle sm:text-[15px]"}
            >
              {t.tabs[s]}
            </button>
          ))}
        </div>

        <div id="order-panel" role="tabpanel" aria-labelledby={`tab-${service}`} className="grid min-w-0 gap-6 rounded-card border border-line bg-card p-5 sm:p-6">
          {service === "lesson" && (
            <>
              <fieldset className="min-w-0">
                <legend className="text-[15px] font-bold">{t.lesson.trialQuestion} <Req t={t.required} /></legend>
                <div className="mt-3 flex gap-3">
                  {(["no", "yes"] as const).map((v) => (
                    <label key={v} className={`${optionBase} ${trialTaken === v ? optionOn : optionOff}`}>
                      <input type="radio" name="trial" value={v} checked={trialTaken === v} onChange={() => chooseTrial(v)} className="mt-0.5 accent-navy" />
                      {v === "yes" ? t.lesson.trialYes : t.lesson.trialNo}
                    </label>
                  ))}
                </div>
                <FieldError id="err-trial" text={err("trial") && t.actions.fixErrors} />
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="text-[15px] font-bold">{t.lesson.plan} <Req t={t.required} /></legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {lessonPlans.map((p) => {
                    const disabled = p.firstTimeOnly && trialTaken === "yes";
                    return (
                      <label key={p.id} className={`${optionBase} ${disabled ? "cursor-not-allowed border-line bg-subtle text-muted" : plan === p.id ? optionOn : optionOff}`}>
                        <input type="radio" name="plan" value={p.id} checked={plan === p.id} disabled={disabled} onChange={() => setPlan(p.id)} className="mt-0.5 accent-navy" />
                        <span>
                          <span className="block font-bold">{t.lesson.plans[p.id]}</span>
                          <span className="block text-[13px]">
                            {yen(p.price)}
                            {p.minutes != null && ` · ${t.lesson.minutes(p.minutes)}`}
                            {p.firstTimeOnly && ` · ${t.lesson.firstTimeOnly}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {trialTaken === "yes" && <p className="mt-2 text-[13px] text-muted">{t.lesson.trialUsedNote}</p>}
                <FieldError id="err-plan" text={err("plan") && t.actions.fixErrors} />
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="text-[15px] font-bold">{t.lesson.candidates} <Req t={t.required} /></legend>
                <p className="mt-1 text-[13px] text-muted">{t.lesson.candidatesHelp}</p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {days.map((d, i) => {
                    const count = candidates.filter((c) => c.date === d.date).length;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        aria-pressed={activeDate === d.date}
                        onClick={() => setActiveDate(d.date)}
                        className={`shrink-0 rounded-control border px-3 py-2 text-center text-[13px] ${activeDate === d.date ? "border-navy bg-navy text-white" : "border-muted bg-card text-ink hover:bg-subtle"}`}
                      >
                        <span className="block">{i === 0 ? t.lesson.today : t.lesson.weekdays[d.weekday]}</span>
                        <span className="block font-bold tabular-nums">{Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))}</span>
                        {count > 0 && <span className="mt-0.5 block text-[11px]">✓{count}</span>}
                      </button>
                    );
                  })}
                </div>
                {activeDate && now && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label={dayText(activeDate)}>
                    {lessonStartTimes.map((time) => {
                      const past = isPast(activeDate, time, now, lessonTimeZone);
                      const on = candidates.some((c) => c.date === activeDate && c.time === time);
                      const late = endsAfter(time, planInfo?.minutes ?? null, lessonDayEnd);
                      return (
                        <button
                          key={time}
                          type="button"
                          aria-pressed={on}
                          disabled={past}
                          onClick={() => toggleCandidate(activeDate, time)}
                          className={`rounded-full border px-2 py-2 text-[13px] tabular-nums ${past ? "cursor-not-allowed border-line bg-subtle text-muted line-through" : on ? "border-navy bg-navy text-white" : "border-muted bg-card text-ink hover:bg-subtle"}`}
                        >
                          {time}
                          {late && !past && <span aria-hidden="true">*</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {activeDate && <p className="mt-2 text-[12px] text-muted">* {t.lesson.endsLateNote}</p>}
                {candidates.length >= lessonCandidatesMax && <p className="mt-2 text-[13px] text-muted">{t.lesson.candidatesMax(lessonCandidatesMax)}</p>}

                {valid.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-[14px] font-bold">{t.lesson.selected}</h3>
                    <ol className="mt-2 grid gap-2">
                      {valid.map((c, i) => {
                        const index = candidates.findIndex((x) => x.date === c.date && x.time === c.time);
                        const label = `${dayText(c.date)} ${c.time}`;
                        return (
                          <li key={`${c.date}-${c.time}`} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-[14px]">
                            <span className="w-20 shrink-0 text-[12px] text-muted">{t.lesson.priority(i + 1)}</span>
                            <span className="flex-1 tabular-nums">
                              {label}
                              {endsAfter(c.time, planInfo?.minutes ?? null, lessonDayEnd) && <span className="block text-[12px] text-muted">{t.lesson.endsLateNote}</span>}
                            </span>
                            <IconButton label={`${t.lesson.moveUp}: ${label}`} disabled={i === 0} onClick={() => moveCandidate(index, -1)}>↑</IconButton>
                            <IconButton label={`${t.lesson.moveDown}: ${label}`} disabled={i === valid.length - 1} onClick={() => moveCandidate(index, 1)}>↓</IconButton>
                            <IconButton label={`${t.lesson.remove}: ${label}`} onClick={() => toggleCandidate(c.date, c.time)}>×</IconButton>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
                <p className="mt-3 text-[12px] text-muted">{t.lesson.notBooking}</p>
                <FieldError id="err-candidates" text={err("candidates")} />
              </fieldset>
            </>
          )}

          {service === "bowing" && (
            <>
              <fieldset className="min-w-0">
                <legend className="text-[15px] font-bold">{t.bowing.type} <Req t={t.required} /></legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(Object.keys(bowingUnitPrice) as BowingType[]).map((k) => (
                    <label key={k} className={`${optionBase} ${bowingType === k ? optionOn : optionOff}`}>
                      <input type="radio" name="bowingType" value={k} checked={bowingType === k} onChange={() => setBowingType(k)} className="mt-0.5 accent-navy" />
                      <span>
                        <span className="block font-bold">{t.bowing.types[k]}</span>
                        <span className="block text-[13px]">{t.bowing.perPage(yen(bowingUnitPrice[k]))}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {bowingType === "both" && (
                  <p className="mt-2 text-[13px] font-bold">{t.bowing.setDeal(yen(bowingUnitPrice.bowing + bowingUnitPrice.fingering), yen(bowingUnitPrice.both), yen(bowingUnitPrice.bowing + bowingUnitPrice.fingering - bowingUnitPrice.both))}</p>
                )}
              </fieldset>
              <Stepper id="pages" label={t.bowing.pages} value={pages} min={1} max={bowingPagesMax} onChange={setPages} t={t} />
              <div>
                <label htmlFor="score" className="text-[15px] font-bold">{t.bowing.score} <Opt t={t.optional} /></label>
                <input id="score" type="text" value={score} maxLength={200} onChange={(e) => setScore(e.target.value)} placeholder={t.bowing.scorePlaceholder} className={`${inputClass} mt-2`} />
              </div>
              <DeliveryField value={delivery.bowing} onChange={(v) => setDelivery((d) => ({ ...d, bowing: v }))} t={t} name="delivery-bowing" />
            </>
          )}

          {service === "recording" && (
            <>
              <fieldset className="min-w-0">
                <legend className="text-[15px] font-bold">{t.recording.heading} <Req t={t.required} /></legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {recordingInstruments.map((inst) => (
                    <div key={inst.id} className={`rounded-control border p-3 ${tracks[inst.id] > 0 ? optionOn : "border-line"}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold">{t.recording.instruments[inst.id]}</span>
                        <span className="text-[13px]">
                          {t.recording.perTrack(yen(inst.unitPrice))}
                          {inst.outsourced && <span className="ml-2 rounded-tag border border-muted px-1.5 py-0.5 text-[11px] text-muted">{t.recording.outsourced}</span>}
                        </span>
                      </div>
                      <Stepper
                        id={`tracks-${inst.id}`}
                        label={`${t.recording.instruments[inst.id]} ${t.recording.tracks}`}
                        value={tracks[inst.id]}
                        min={0}
                        max={recordingTracksMax}
                        onChange={(v) => setTracks((s) => ({ ...s, [inst.id]: v }))}
                        t={t}
                        compact
                      />
                    </div>
                  ))}
                </div>
                <FieldError id="err-tracks" text={err("tracks")} />
              </fieldset>
              {tracks.other > 0 && (
                <div>
                  <label htmlFor="otherDetail" className="text-[15px] font-bold">{t.recording.otherDetail} <Opt t={t.optional} /></label>
                  <input id="otherDetail" type="text" value={otherDetail} maxLength={200} onChange={(e) => setOtherDetail(e.target.value)} placeholder={t.recording.otherDetailPlaceholder} className={`${inputClass} mt-2`} />
                </div>
              )}
              <DeliveryField value={delivery.recording} onChange={(v) => setDelivery((d) => ({ ...d, recording: v }))} t={t} name="delivery-recording" />
            </>
          )}
        </div>

        <fieldset className="min-w-0 grid gap-4 rounded-card border border-line bg-card p-5 sm:grid-cols-2 sm:p-6">
          <legend className="sr-only">{t.common.heading}</legend>
          <h2 className="text-base font-bold sm:col-span-2" aria-hidden="true">{t.common.heading}</h2>
          <TextField id="name" label={t.common.name} value={name} onChange={setName} required t={t} error={err("name")} autoComplete="name" />
          <TextField id="email" type="email" label={t.common.email} value={email} onChange={setEmail} required t={t} error={err("email")} autoComplete="email" />
          <div className="sm:col-span-2">
            <label htmlFor="remarks" className="text-[14px] font-bold">{t.common.remarks} <Opt t={t.optional} /></label>
            <textarea id="remarks" rows={3} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t.common.remarksPlaceholder} className={`${inputClass} mt-2`} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-[14px]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!err("consent")} aria-describedby={err("consent") ? "err-consent" : undefined} className="mt-1 h-4 w-4 accent-navy" />
              <span>
                {t.common.consent}{locale === "ja" ? "（" : " ("}<Link href={localizedPath(locale, pagePaths.privacy)} className="underline" target="_blank">{t.common.privacyLink}</Link>{locale === "ja" ? "）" : ")"}
              </span>
            </label>
            <FieldError id="err-consent" text={err("consent")} />
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4">
        {summaryCard}
        {showErrors && hasErrors && <p role="alert" className="rounded-control border border-navy bg-subtle p-3 text-[14px] font-bold">{t.actions.fixErrors}</p>}
        <button type="submit" className="rounded-button bg-navy px-5 py-3.5 text-[15px] font-bold text-white hover:brightness-110">
          {t.actions.review}
        </button>
      </div>
    </form>
  );
}

type T = ReturnType<typeof getDictionary>["orderForm"];

function Req({ t }: { t: string }) {
  return <span className="ml-1 rounded-tag bg-navy px-1.5 py-0.5 align-middle text-[11px] font-normal text-white">{t}</span>;
}

function Opt({ t }: { t: string }) {
  return <span className="ml-1 rounded-tag border border-muted px-1.5 py-0.5 align-middle text-[11px] font-normal text-muted">{t}</span>;
}

function FieldError({ id, text }: { id: string; text?: string | false }) {
  if (!text) return null;
  return <p id={id} className="mt-2 text-[13px] font-bold text-ink">⚠ {text}</p>;
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full border border-muted bg-card text-[14px] hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40">
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function TextField({ id, label, value, onChange, required, t, error, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; t: T; error?: string; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-bold">
        {label} {required ? <Req t={t.required} /> : <Opt t={t.optional} />}
      </label>
      <input id={id} type={type} value={value} maxLength={200} autoComplete={autoComplete} required={required} aria-invalid={!!error} aria-describedby={error ? `err-${id}` : undefined} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-2`} />
      <FieldError id={`err-${id}`} text={error} />
    </div>
  );
}

// 数量の入力（− / 数値 / ＋）。直接入力しても範囲内の整数に丸める
function Stepper({ id, label, value, min, max, onChange, t, compact }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; t: T; compact?: boolean }) {
  const btn = "grid h-10 w-10 place-items-center rounded-full border border-muted bg-card text-lg hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={compact ? "mt-2" : ""}>
      <label htmlFor={id} className={compact ? "sr-only" : "text-[15px] font-bold"}>{label}</label>
      <div className={`flex items-center gap-2 ${compact ? "" : "mt-2"}`}>
        <button type="button" className={btn} aria-label={`${label}: ${t.stepper.decrease}`} disabled={value <= min} onClick={() => onChange(clampInt(value - 1, min, max))}>
          <span aria-hidden="true">−</span>
        </button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} step={1} value={value} onChange={(e) => onChange(clampInt(e.target.value, min, max))} className="w-20 rounded-control border border-muted bg-card p-2 text-center text-[15px] tabular-nums text-ink" />
        <button type="button" className={btn} aria-label={`${label}: ${t.stepper.increase}`} disabled={value >= max} onClick={() => onChange(clampInt(value + 1, min, max))}>
          <span aria-hidden="true">＋</span>
        </button>
      </div>
    </div>
  );
}

function DeliveryField({ value, onChange, t, name }: { value: DeliveryId; onChange: (v: DeliveryId) => void; t: T; name: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[15px] font-bold">{t.delivery.heading} <Req t={t.required} /></legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {deliveryOptions.map((o) => (
          <label key={o.id} className={`${optionBase} ${value === o.id ? optionOn : optionOff}`}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="mt-0.5 accent-navy" />
            <span>
              <span className="block font-bold">{t.delivery.options[o.id]}</span>
              <span className="block text-[13px] tabular-nums">{t.delivery.factor(factorText(o.factorTenths))}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.delivery.startNote}</p>
    </fieldset>
  );
}
