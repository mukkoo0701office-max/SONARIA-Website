"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  lessonPlanPrices,
  quoteBowing,
  serviceDefs,
  validateFiles,
  validateStep,
  type Errors,
  type FileError,
  type FormData,
  type LessonPlan,
  type ServiceId,
} from "@shared/schema";
import FormField from "@/components/forms/FormField";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { backendConfigured, completeUploads, fetchTaxMode, submitApplication, turnstileSiteKey, uploadFiles } from "@/lib/backend";
import { localizedPath, type Locale } from "@/lib/i18n";
import { countPdfPages } from "@/lib/pdfPages";

// 申し込みフォーム（ステップ形式 → 確認 → 完了）。
// 入力検証・料金計算は画面でも行うが、サーバー（Edge Function）で必ずやり直す。
// バックエンドが未接続のときは送信ボタンを無効にし、「未接続」と表示する（送信できるように見せない）。

type Phase = { kind: "step"; index: number } | { kind: "confirm" } | { kind: "done" };

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string };
  }
}

const yen = (n: number, locale: Locale) => (locale === "ja" ? `${n.toLocaleString("ja-JP")}円` : `¥${n.toLocaleString("en-US")}`);

export default function ApplicationForm({ locale, service, servicePage }: { locale: Locale; service: ServiceId; servicePage: string }) {
  const dict = getDictionary(locale);
  const t = dict.forms;
  const c = t.common;
  const copy = t[service];
  const def = serviceDefs[service];
  const filesStepKey = service === "bowing" ? "piece" : null;

  const [phase, setPhase] = useState<Phase>({ kind: "step", index: 0 });
  const [data, setData] = useState<FormData>({});
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [pageHint, setPageHint] = useState<number | null>(null);
  const [taxMode, setTaxMode] = useState<"undecided" | "included" | "excluded">("undecided");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ receiptNo: string; applicantEmail?: string; failedUploads: string[] } | null>(null);
  const [pendingUploads, setPendingUploads] = useState<{ path: string; token: string; name: string }[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const requestId = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);

  // 1 回の申し込みごとの ID（同じ ID の再送はサーバーで同じ受付番号になる＝二重送信防止）
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    if (service === "bowing") fetchTaxMode().then(setTaxMode);
  }, [service]);

  // 画面が切り替わったら見出しにフォーカスを移す（読み上げ・スクロール位置のため）
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  // Cloudflare Turnstile（サイトキーが設定されているときだけ）
  useEffect(() => {
    if (!turnstileSiteKey || phase.kind !== "confirm" || !captchaRef.current) return;
    const el = captchaRef.current;
    const render = () => window.turnstile?.render(el, { sitekey: turnstileSiteKey, callback: setCaptchaToken });
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [phase]);

  const setField = (key: string, value: string | string[] | boolean) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const fileMetas = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));
  const quote = useMemo(() => (service === "bowing" ? quoteBowing(data.service as string, data.pages) : null), [service, data.service, data.pages]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    setFileError(null);
    // 参考値: PDF のページ数を読み取る（画像は 1 枚 1 ページ）。最終的なページ数は申込者が指定する
    let total = 0;
    let known = true;
    for (const f of next) {
      if (f.type === "application/pdf") {
        const n = await countPdfPages(f);
        if (n === null) known = false;
        else total += n;
      } else {
        total += 1;
      }
    }
    setPageHint(known && total > 0 ? total : null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPageHint(null);
  }

  function goNext(index: number) {
    const step = def.steps[index];
    const stepErrors = validateStep(step, data);
    const fErr = step.key === filesStepKey ? validateFiles(def.files, fileMetas) : null;
    setErrors(stepErrors);
    setFileError(fErr);
    if (Object.keys(stepErrors).length || fErr) {
      // 最初のエラー項目へフォーカス
      const first = step.fields.find((f) => stepErrors[f.key]);
      requestAnimationFrame(() => document.getElementById(first ? `field-${first.key}` : "field-files")?.focus());
      return;
    }
    setPhase(index + 1 < def.steps.length ? { kind: "step", index: index + 1 } : { kind: "confirm" });
  }

  async function finishUploads(uploads: { path: string; token: string; name: string }[]) {
    if (!uploads.length) return [];
    const failed = await uploadFiles(uploads, files);
    await completeUploads(requestId.current);
    setPendingUploads(uploads.filter((u) => failed.includes(u.name)));
    return failed;
  }

  async function handleSubmit() {
    if (!backendConfigured || submitting) return;
    if (turnstileSiteKey && !captchaToken) {
      setSubmitError(c.captcha);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const res = await submitApplication({
      service,
      locale,
      requestId: requestId.current,
      data,
      files: fileMetas,
      website: honeypot,
      turnstileToken: captchaToken,
    });
    if (!res.ok) {
      setSubmitting(false);
      if (res.error === "validation") {
        setErrors((res.errors ?? {}) as Errors);
        setFileError((res.fileError as FileError) ?? null);
        const idx = def.steps.findIndex((s) => s.fields.some((f) => res.errors?.[f.key]) || (s.key === filesStepKey && res.fileError));
        setPhase({ kind: "step", index: Math.max(0, idx) });
        return;
      }
      setSubmitError(res.error === "network" ? c.networkError : res.error === "rate_limited" ? c.rateLimited : res.error === "captcha" ? c.captcha : c.serverError);
      return;
    }
    const failed = await finishUploads(res.uploads);
    setResult({ receiptNo: res.receiptNo, applicantEmail: res.applicantEmail, failedUploads: failed });
    setSubmitting(false);
    setPhase({ kind: "done" });
  }

  async function retryUploads() {
    setSubmitting(true);
    const failed = await finishUploads(pendingUploads);
    setResult((prev) => (prev ? { ...prev, failedUploads: failed } : prev));
    setSubmitting(false);
  }

  const errorText = (key: string, e: string) => {
    const field = def.steps.flatMap((s) => s.fields).find((f) => f.key === key);
    if (e === "email" && field?.type === "tel") return c.errors.tel;
    return c.errors[e as keyof typeof c.errors] ?? c.errors.required;
  };

  const privacyHref = localizedPath(locale, pagePaths.privacy);
  const stepCount = def.steps.length;

  // ---------- 料金表示 ----------
  const lessonPriceExtra = (opt: string) =>
    service === "lesson" && opt in lessonPlanPrices ? (
      <span className="mt-0.5 block text-[13px] font-semibold text-navy">{t.lesson.plans[opt as LessonPlan].detail}</span>
    ) : null;
  const lessonOptionLabel = (opt: string) => (service === "lesson" && opt in lessonPlanPrices ? t.lesson.plans[opt as LessonPlan].name : opt);

  const bowingPricePanel =
    service === "bowing" ? (
      <aside aria-live="polite" className="rounded-card border-2 border-navy bg-card p-5">
        <h2 className="text-[13px] font-semibold text-muted">{t.bowing.priceTitle}</h2>
        {quote ? (
          <>
            <p className="mt-1 text-[28px] font-bold leading-tight text-navy">
              {yen(quote.totalYen, locale)}
              <span className="ml-2 text-[12px] font-normal text-muted">
                {taxMode === "undecided" ? t.bowing.tax.undecided : t.bowing.tax[taxMode]}
              </span>
            </p>
            <p className="mt-1 text-[13px]">{t.bowing.breakdown(quote.pages, yen(quote.unitYen, locale), yen(quote.totalYen, locale))}</p>
            {quote.consultDiscount && <p className="mt-2 rounded-button bg-paper p-2 text-[13px]">{t.bowing.consult}</p>}
          </>
        ) : (
          <p className="mt-1 text-[13px]">{t.bowing.pagesPrompt}</p>
        )}
        <ul className="mt-3 grid gap-0.5 text-[12px] text-muted">
          {(["fingering", "bowing", "both"] as const).map((k) => (
            <li key={k}>{t.bowing.unit[k]}</li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted">{t.bowing.estimateNote}</p>
      </aside>
    ) : null;

  const lessonPricePanel =
    service === "lesson" ? (
      <aside className="rounded-card border border-line bg-card p-5">
        <h2 className="text-[13px] font-semibold">{t.lesson.priceTitle}</h2>
        <dl className="mt-2 grid gap-1 text-[13px]">
          {(Object.keys(t.lesson.plans) as LessonPlan[]).map((p) => (
            <div key={p} className={data.plan === p ? "flex justify-between gap-3 font-semibold text-navy" : "flex justify-between gap-3"}>
              <dt>{t.lesson.plans[p].name}</dt>
              <dd className="text-right">{t.lesson.plans[p].detail}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[12px] text-muted">{t.lesson.priceNote}</p>
      </aside>
    ) : null;

  const notConnected = !backendConfigured ? (
    <div role="status" className="mb-6 rounded-card border-2 border-dashed border-muted bg-card p-4 text-[13px] leading-relaxed">
      <p className="font-semibold">{c.notConnectedTitle}</p>
      <p className="mt-1">{c.notConnectedBody}</p>
    </div>
  ) : null;

  // ---------- 表示用の値（確認画面） ----------
  const display = (key: string) => {
    const field = def.steps.flatMap((s) => s.fields).find((f) => f.key === key)!;
    const v = data[key];
    const fc = copy.fields[key];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || v === false) return c.noValue;
    if (field.type === "consent") return c.agree;
    if (Array.isArray(v)) return v.map((x) => fc?.options?.[x] ?? x).join("、");
    if (typeof v === "string" && (field.type === "radio" || field.type === "select")) {
      if (service === "lesson" && key === "plan") return `${t.lesson.plans[v as LessonPlan].name}（${t.lesson.plans[v as LessonPlan].detail}）`;
      return fc?.options?.[v] ?? v;
    }
    if (typeof v === "string" && field.type === "datetime") return v.replace("T", " ");
    return String(v);
  };

  // ---------- 画面 ----------
  if (phase.kind === "done" && result) {
    return (
      <div className="rounded-card border border-line bg-card p-6 sm:p-10">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {c.doneTitle}
        </h1>
        <p className="mt-6 text-[13px] text-muted">{c.receiptLabel}</p>
        <p className="font-mono text-[28px] font-bold tracking-wider text-navy">{result.receiptNo}</p>
        <p className="mt-4 rounded-button bg-paper p-3 text-[14px] font-semibold">{c.notContract}</p>
        <p className="mt-4 text-[14px] leading-relaxed">{c.doneLead}</p>
        <p className="mt-2 text-[13px] text-muted">{result.applicantEmail === "sent" ? c.applicantEmailSent : c.applicantEmailDisabled}</p>
        {result.failedUploads.length > 0 && (
          <div role="alert" className="mt-4 rounded-button border-2 border-danger p-3 text-[13px]">
            <p>{c.uploadFailed(result.failedUploads.join(", "))}</p>
            <button
              type="button"
              onClick={retryUploads}
              disabled={submitting}
              className="mt-2 rounded-button border border-navy bg-navy px-4 py-2 text-white disabled:opacity-50"
            >
              {submitting ? c.uploading : c.retryUpload}
            </button>
          </div>
        )}
        <Link href={localizedPath(locale, servicePage)} className="mt-8 inline-block text-[13px] text-navy underline">
          {c.backToService}
        </Link>
      </div>
    );
  }

  const sidePanel = bowingPricePanel ?? lessonPricePanel;

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed">{copy.lead}</p>

      <div className="mt-6">{notConnected}</div>

      {/* ステップ表示 */}
      <ol className="mb-6 flex flex-wrap gap-2 text-[12px]" aria-label={c.stepOf(phase.kind === "step" ? phase.index + 1 : stepCount, stepCount)}>
        {def.steps.map((s, i) => {
          const active = phase.kind === "step" && phase.index === i;
          const done = phase.kind === "confirm" || (phase.kind === "step" && phase.index > i);
          return (
            <li
              key={s.key}
              aria-current={active ? "step" : undefined}
              className={
                active
                  ? "rounded-full bg-navy px-3 py-1.5 text-white"
                  : done
                    ? "rounded-full border border-navy px-3 py-1.5 text-navy"
                    : "rounded-full border border-line px-3 py-1.5 text-muted"
              }
            >
              {i + 1}. {copy.steps[s.key]}
            </li>
          );
        })}
        <li
          aria-current={phase.kind === "confirm" ? "step" : undefined}
          className={phase.kind === "confirm" ? "rounded-full bg-navy px-3 py-1.5 text-white" : "rounded-full border border-line px-3 py-1.5 text-muted"}
        >
          {stepCount + 1}. {c.confirmTitle}
        </li>
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="rounded-card border border-line bg-card p-5 sm:p-8">
          {phase.kind === "step" &&
            (() => {
              const step = def.steps[phase.index];
              const errorKeys = Object.keys(errors);
              return (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    goNext(phase.index);
                  }}
                >
                  <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
                    <span className="mr-2 text-[12px] font-normal text-muted">{c.stepOf(phase.index + 1, stepCount)}</span>
                    {copy.steps[step.key]}
                  </h2>

                  {(errorKeys.length > 0 || fileError) && (
                    <div role="alert" className="mt-4 rounded-button border-2 border-danger p-3 text-[13px] font-semibold text-danger">
                      {c.errorSummary}
                    </div>
                  )}

                  {/* ボット対策: 人には見えない欄。入力があれば送信を拒否する */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                    <label>
                      {c.honeypotLabel}
                      <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                    </label>
                  </div>

                  <div className="mt-6 grid gap-6">
                    {step.fields.map((field) => (
                      <div key={field.key}>
                        {field.key === "preferred1" && service === "lesson" && (
                          <p className="mb-3 text-xs text-muted">{t.lesson.datetimeHelp}</p>
                        )}
                        {/* 出張以外のときは希望地域を出さない */}
                        {field.key === "travelArea" && data.format !== "visiting" ? null : (
                          <FormField
                            field={field}
                            copy={copy.fields[field.key] ?? { label: field.key }}
                            data={data}
                            error={errors[field.key]}
                            errorText={errors[field.key] ? errorText(field.key, errors[field.key]) : undefined}
                            requiredLabel={c.required}
                            optionalLabel={c.optional}
                            privacyHref={privacyHref}
                            privacyLabel={c.privacyLink}
                            onChange={setField}
                            optionExtra={field.key === "plan" ? lessonPriceExtra : undefined}
                            optionLabel={field.key === "plan" ? lessonOptionLabel : undefined}
                          />
                        )}
                        {/* 運指・ボウイング: ページ数の下に添付ファイル */}
                        {field.key === "pages" && step.key === filesStepKey && def.files && (
                          <div className="mt-6 grid gap-2">
                            <p className="text-[13px] font-semibold">
                              {c.filesLabel}
                              <span className="ml-2 rounded-tag bg-navy px-1.5 py-0.5 text-[10px] text-white">{c.required}</span>
                            </p>
                            <ul className="grid list-disc gap-1 rounded-button bg-paper p-3 pl-7 text-[12px] leading-relaxed">
                              {t.bowing.filesNotice.map((n) => (
                                <li key={n}>{n}</li>
                              ))}
                            </ul>
                            <p className="text-xs text-muted">{c.filesHelp(def.files.maxFiles, def.files.maxBytes / 1024 / 1024)}</p>
                            <label className="inline-flex w-fit cursor-pointer items-center rounded-button border border-navy px-4 py-2.5 text-[13px] text-navy hover:bg-paper">
                              {c.filesChoose}
                              <input
                                id="field-files"
                                type="file"
                                multiple
                                accept={def.files.accept.map((a) => `.${a.ext}`).join(",")}
                                className="sr-only"
                                aria-invalid={fileError ? true : undefined}
                                onChange={(e) => {
                                  addFiles(e.target.files);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {files.length > 0 && (
                              <ul className="grid gap-1 text-[13px]">
                                {files.map((f, i) => (
                                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-button border border-line px-3 py-2">
                                    <span className="truncate">
                                      {f.name}
                                      <span className="ml-2 text-xs text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                                    </span>
                                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-xs text-navy underline">
                                      {c.filesRemove}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {pageHint !== null && (
                              <p className="text-[13px]">
                                {c.filesPageHint(pageHint)}{" "}
                                <button type="button" onClick={() => setField("pages", String(pageHint))} className="text-navy underline">
                                  {c.filesUseHint}
                                </button>
                              </p>
                            )}
                            {fileError && <p className="text-[13px] font-semibold text-danger">{c.fileErrors[fileError]}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap justify-between gap-3">
                    {phase.index > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPhase({ kind: "step", index: phase.index - 1 })}
                        className="rounded-button border border-line px-5 py-3 text-[14px] text-navy hover:bg-paper"
                      >
                        {c.back}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="submit" className="rounded-button border border-navy bg-navy px-6 py-3 text-[14px] font-semibold text-white hover:brightness-95">
                      {phase.index + 1 < stepCount ? c.next : c.toConfirm}
                    </button>
                  </div>
                </form>
              );
            })()}

          {phase.kind === "confirm" && (
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
                {c.confirmTitle}
              </h2>
              <p className="mt-1 text-[13px] text-muted">{c.confirmLead}</p>
              {def.steps.map((s, i) => (
                <section key={s.key} className="mt-6">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <h3 className="text-[14px] font-semibold">{copy.steps[s.key]}</h3>
                    <button type="button" onClick={() => setPhase({ kind: "step", index: i })} className="text-[13px] text-navy underline">
                      {c.edit}
                    </button>
                  </div>
                  <dl className="mt-2 grid gap-2 text-[14px]">
                    {s.fields
                      .filter((f) => !(f.key === "travelArea" && data.format !== "visiting"))
                      .map((f) => (
                        <div key={f.key} className="grid gap-0.5 sm:grid-cols-[200px_1fr] sm:gap-4">
                          <dt className="text-[12px] text-muted sm:text-[13px]">{copy.fields[f.key]?.label ?? f.key}</dt>
                          <dd className="whitespace-pre-wrap break-words">{display(f.key)}</dd>
                        </div>
                      ))}
                    {s.key === filesStepKey && (
                      <div className="grid gap-0.5 sm:grid-cols-[200px_1fr] sm:gap-4">
                        <dt className="text-[12px] text-muted sm:text-[13px]">{c.filesLabel}</dt>
                        <dd>{files.map((f) => f.name).join("、") || c.noValue}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              ))}

              {turnstileSiteKey && <div ref={captchaRef} className="mt-6" />}

              {submitError && (
                <p role="alert" className="mt-6 rounded-button border-2 border-danger p-3 text-[13px] font-semibold text-danger">
                  {submitError}
                </p>
              )}

              <p className="mt-6 text-[13px] text-muted">{c.notContract}</p>
              <div className="mt-4 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPhase({ kind: "step", index: stepCount - 1 })}
                  className="rounded-button border border-line px-5 py-3 text-[14px] text-navy hover:bg-paper"
                >
                  {c.back}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!backendConfigured || submitting}
                  aria-disabled={!backendConfigured || submitting}
                  className="rounded-button border border-navy bg-navy px-6 py-3 text-[14px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? c.submitting : c.submit}
                </button>
              </div>
              {!backendConfigured && <p className="mt-2 text-right text-[12px] text-muted">{c.notConnectedTitle}</p>}
            </div>
          )}
        </div>

        {sidePanel && <div className="lg:sticky lg:top-32">{sidePanel}</div>}
      </div>
    </div>
  );
}
