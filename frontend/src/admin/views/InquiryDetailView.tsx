"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import { fmtDate, fmtMoney, fmtNumber } from "../i18n";
import { caseStatuses, type InquiryPatch } from "../repository";
import { caseTone } from "../theme";
import type { CaseStatus, Inquiry, InquiryMessage, PaymentStatus } from "../types";
import { adminRoutes, Badge, buttonDanger, buttonPrimary, buttonSecondary, Card, Field, inputClass, LoadState, Modal, NotConnected, PageTitle } from "../ui";

const paymentStatuses: PaymentStatus[] = ["none", "unbilled", "billed", "paid", "overdue", "refunded"];
const toLocalInput = (iso?: string) => (iso ? iso.slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? `${v}:00+09:00` : undefined);

export default function InquiryDetailView() {
  const { t, locale, repo } = useAdmin();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id")), []);

  const data = useAdminData(
    async (r) => {
      if (!id) return null;
      const [inquiry, messages, history, templates] = await Promise.all([r.getInquiry(id), r.listMessages(id), r.listStatusHistory(id), r.listTemplates()]);
      // 開いたら既読にする
      if (inquiry && inquiry.readState === "unread") await r.updateInquiry(id, { readState: "read" });
      return inquiry ? { inquiry: { ...inquiry, readState: "read" as const }, messages, history, templates } : null;
    },
    [id],
  );

  const inq = data.data?.inquiry;
  const [form, setForm] = useState<InquiryPatch & { note: string }>({ note: "" });
  const [flash, setFlash] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState(false);
  const [sendResult, setSendResult] = useState<InquiryMessage | null>(null);
  // 非表示・削除（確認の画面つき）
  const router = useRouter();
  const [removeMode, setRemoveMode] = useState<"hide" | "delete" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  async function doRemove() {
    if (!repo || !inq || !removeMode) return;
    setRemoveBusy(true);
    setRemoveError(false);
    try {
      if (removeMode === "hide") await repo.hideInquiry(inq.id);
      else await repo.deleteInquiry(inq.id);
      router.replace(adminRoutes.inquiries);
    } catch {
      setRemoveError(true);
      setRemoveBusy(false);
    }
  }

  useEffect(() => {
    if (!inq) return;
    setForm({ caseStatus: inq.caseStatus, quote: inq.quote, payment: inq.payment, scheduledAt: inq.scheduledAt, dueDate: inq.dueDate, internalMemo: inq.internalMemo, note: "" });
    const draft = data.data?.messages.find((m) => m.status === "draft");
    setSubject(draft?.subject ?? "");
    setBody(draft?.body ?? "");
  }, [inq, data.data]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!id && data.status !== "loading") return <p>{t.detail.notFound}</p>;

  const money = (n?: number) => (n === undefined ? "—" : fmtMoney(n, locale, inq?.quote?.currency ?? "JPY"));

  function applyTemplate(tid: string) {
    setTemplateId(tid);
    const tpl = data.data?.templates.find((x) => x.id === tid);
    if (!tpl || !inq) return;
    const fill = (s: string) => s.replaceAll("{name}", inq.requester.name).replaceAll("{amount}", money(form.quote?.confirmedAmount ?? form.quote?.amount));
    setSubject(fill(tpl.subject[locale]));
    setBody(fill(tpl.body[locale]));
  }

  async function saveCase(extra?: Partial<InquiryPatch>) {
    if (!repo || !inq) return;
    const { note, ...patch } = { ...form, ...extra };
    await repo.updateInquiry(inq.id, patch, note || undefined);
    setFlash(t.common.saved);
    data.reload();
  }

  async function saveDraft() {
    if (!repo || !inq) return;
    await repo.saveDraft(inq.id, { subject, body, templateId: templateId || undefined });
    setFlash(t.detail.draftSaved);
    data.reload();
  }

  async function send() {
    if (!repo || !inq) return;
    const msg = await repo.sendReply(inq.id, { subject, body, templateId: templateId || undefined });
    setSendResult(msg);
    setPreview(false);
    // 送信できていないので「返信済み」にはしない（status が sent のときだけ更新する）
    if (msg.status === "sent") await repo.updateInquiry(inq.id, { replyState: "replied" });
    setSubject("");
    setBody("");
    data.reload();
  }

  const setQuote = (patch: Partial<NonNullable<Inquiry["quote"]>>) => setForm((f) => ({ ...f, quote: { amount: 0, currency: "JPY", ...f.quote, ...patch } }));
  const setPayment = (patch: Partial<NonNullable<Inquiry["payment"]>>) => setForm((f) => ({ ...f, payment: { status: "none", ...f.payment, ...patch } }));
  const num = (v: string) => (v === "" ? undefined : Math.max(0, Math.round(Number(v))));

  return (
    <>
      <Link href={adminRoutes.inquiries} className="text-[13px] text-navy underline">
        ← {t.common.back}
      </Link>
      <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} onRetry={data.reload}>
        {!inq ? (
          <p className="mt-4">{t.detail.notFound}</p>
        ) : (
          <>
            <div className="mt-3">
              <PageTitle
                title={inq.subject}
                lead={`${inq.receiptNo}・${t.kinds[inq.kind]}・${inq.requester.name}・${fmtDate(inq.receivedAt, locale, true)}`}
                actions={
                  <>
                    <Badge tone={caseTone[inq.caseStatus]}>{t.caseStatus[inq.caseStatus]}</Badge>
                    <Badge tone={inq.replyState === "replied" ? "good" : "warn"}>{t.replyState[inq.replyState]}</Badge>
                  </>
                }
              />
            </div>
            {flash && (
              <p role="status" className="mb-3 rounded-control border border-[#9fd9a9] bg-[#eefaf0] px-3 py-2 text-[13px]">
                {flash}
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <div className="grid min-w-0 gap-4">
                <Card title={t.detail.request} id="d-request">
                  <dl className="grid gap-0 text-[14px]">
                    {inq.fields.map((f) => (
                      <div key={f.label} className="grid gap-1 border-b border-line py-2 last:border-0 sm:grid-cols-[140px_1fr]">
                        <dt className="text-muted">{f.label}</dt>
                        <dd className="whitespace-pre-wrap break-words">{f.value}</dd>
                      </div>
                    ))}
                    <div className="grid gap-1 py-2 sm:grid-cols-[140px_1fr]">
                      <dt className="text-muted">Email</dt>
                      <dd className="break-all">{inq.requester.email}</dd>
                    </div>
                  </dl>
                </Card>

                <Card title={t.detail.reply} id="d-reply">
                  <NotConnected>{t.detail.mailNotConnected}</NotConnected>
                  {sendResult && (
                    <p role="status" className="mt-3 rounded-control border border-[#f5cf7a] bg-[#fff8e6] p-3 text-[13px]">
                      {sendResult.status === "sent" ? t.detail.msgStatus.sent : t.detail.sendNotConnected}
                    </p>
                  )}
                  <div className="mt-3 grid gap-3">
                    <Field label={t.detail.template} htmlFor="d-template">
                      <select id="d-template" value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={inputClass}>
                        <option value="">{t.detail.templateNone}</option>
                        {data.data?.templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name[locale]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t.detail.replySubject} htmlFor="d-subject">
                      <input id="d-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={inputClass} />
                    </Field>
                    <Field label={t.detail.replyBody} htmlFor="d-body">
                      <textarea id="d-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} className={inputClass} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveDraft} disabled={!subject && !body} className={buttonSecondary}>
                        {t.detail.saveDraft}
                      </button>
                      <button type="button" onClick={() => setPreview(true)} disabled={!subject || !body} className={buttonPrimary}>
                        {t.detail.preview}
                      </button>
                    </div>
                  </div>
                </Card>

                <Card title={t.detail.history} id="d-history">
                  {data.data && data.data.messages.filter((m) => m.status !== "draft").length === 0 ? (
                    <p className="text-[13px] text-muted">{t.common.empty}</p>
                  ) : (
                    <ol className="grid gap-3">
                      {data.data?.messages
                        .filter((m) => m.status !== "draft")
                        .map((m) => (
                          <li key={m.id} className="rounded-control border border-line p-3">
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                              <Badge tone={m.direction === "inbound" ? "info" : "neutral"}>{m.direction === "inbound" ? t.detail.inbound : t.detail.outbound}</Badge>
                              <Badge tone={m.status === "sent" ? "good" : m.status === "failed" ? "danger" : "warn"}>{t.detail.msgStatus[m.status]}</Badge>
                              {fmtDate(m.createdAt, locale, true)}
                            </div>
                            <p className="mt-2 text-[14px] font-semibold">{m.subject}</p>
                            <p className="mt-1 whitespace-pre-wrap text-[13px]">{m.body}</p>
                          </li>
                        ))}
                    </ol>
                  )}
                </Card>
              </div>

              <div className="grid min-w-0 content-start gap-4">
                <Card title={t.detail.caseStatus} id="d-case">
                  <div className="grid gap-3">
                    <Field label={t.detail.caseStatus} htmlFor="d-status">
                      <select id="d-status" value={form.caseStatus} onChange={(e) => setForm((f) => ({ ...f, caseStatus: e.target.value as CaseStatus }))} className={inputClass}>
                        {caseStatuses.map((s) => (
                          <option key={s} value={s}>
                            {t.caseStatus[s]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t.detail.quoteAmount} htmlFor="d-quote">
                        <input id="d-quote" type="number" inputMode="numeric" min={0} value={form.quote?.amount ?? ""} onChange={(e) => setQuote({ amount: num(e.target.value) ?? 0 })} className={inputClass} />
                      </Field>
                      <Field label={t.detail.confirmedAmount} htmlFor="d-confirmed">
                        <input id="d-confirmed" type="number" inputMode="numeric" min={0} value={form.quote?.confirmedAmount ?? ""} onChange={(e) => setQuote({ confirmedAmount: num(e.target.value) })} className={inputClass} />
                      </Field>
                    </div>
                    <Field label={t.detail.confirmedAt} htmlFor="d-confirmed-at">
                      <input id="d-confirmed-at" type="datetime-local" value={toLocalInput(form.quote?.confirmedAt)} onChange={(e) => setQuote({ confirmedAt: fromLocalInput(e.target.value) })} className={inputClass} />
                    </Field>
                    <Field label={t.detail.scheduledAt} htmlFor="d-scheduled">
                      <input id="d-scheduled" type="datetime-local" value={toLocalInput(form.scheduledAt)} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: fromLocalInput(e.target.value) }))} className={inputClass} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t.detail.dueDate} htmlFor="d-due">
                        <input id="d-due" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value || undefined }))} className={inputClass} />
                      </Field>
                      <Field label={t.detail.paymentDue} htmlFor="d-paydue">
                        <input id="d-paydue" type="date" value={form.payment?.dueDate ?? ""} onChange={(e) => setPayment({ dueDate: e.target.value || undefined })} className={inputClass} />
                      </Field>
                    </div>
                    <Field label={t.detail.paymentStatus} htmlFor="d-paystatus">
                      <select id="d-paystatus" value={form.payment?.status ?? "none"} onChange={(e) => setPayment({ status: e.target.value as PaymentStatus })} className={inputClass}>
                        {paymentStatuses.map((s) => (
                          <option key={s} value={s}>
                            {t.payment[s]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t.detail.memo} htmlFor="d-memo">
                      <textarea id="d-memo" rows={3} value={form.internalMemo ?? ""} onChange={(e) => setForm((f) => ({ ...f, internalMemo: e.target.value }))} className={inputClass} />
                    </Field>
                    <button type="button" onClick={() => saveCase()} className={buttonPrimary}>
                      {t.detail.saveCase}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => saveCase({ caseStatus: "completed" })} className={buttonSecondary}>
                        {t.detail.complete}
                      </button>
                      <button type="button" onClick={() => saveCase({ caseStatus: "cancelled" })} className={buttonDanger}>
                        {t.detail.cancelCase}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-[13px]">
                      <button type="button" onClick={() => saveCase({ replyState: inq.replyState === "replied" ? "unreplied" : "replied" })} className="underline">
                        {inq.replyState === "replied" ? t.detail.markUnreplied : t.detail.markReplied}
                      </button>
                      {(inq.scheduledAt || inq.dueDate) && (
                        <Link href={adminRoutes.calendar} className="text-navy underline">
                          {t.detail.calendarLink}
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>

                <Card title={t.detail.attachments} id="d-files">
                  {inq.attachments.length === 0 ? (
                    <p className="text-[13px] text-muted">{t.common.empty}</p>
                  ) : (
                    <ul className="grid gap-1 text-[13px]">
                      {inq.attachments.map((a) => (
                        <li key={a.name} className="flex justify-between gap-2">
                          <span className="truncate">{a.name}</span>
                          <span className="text-muted">{fmtNumber(Math.round(a.size / 1024), locale)} KB</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <NotConnected>{t.detail.attachmentsNote}</NotConnected>
                  </div>
                </Card>

                <Card title={t.detail.removeTitle} id="d-remove">
                  <div className="grid gap-3 text-[13px]">
                    <div>
                      <button type="button" onClick={() => { setRemoveMode("hide"); setConfirmText(""); setRemoveError(false); }} className={buttonSecondary}>
                        {t.detail.hide}
                      </button>
                      <p className="mt-1 text-[12px] text-muted">{t.detail.hideLead}</p>
                    </div>
                    <div className="border-t border-line pt-3">
                      <button type="button" onClick={() => { setRemoveMode("delete"); setConfirmText(""); setRemoveError(false); }} className={buttonDanger}>
                        {t.detail.remove}
                      </button>
                      <p className="mt-1 text-[12px] text-muted">{t.detail.removeLead}</p>
                    </div>
                  </div>
                </Card>

                <Card title={t.detail.statusHistory} id="d-status-history">
                  {data.data && data.data.history.length === 0 ? (
                    <p className="text-[13px] text-muted">{t.common.empty}</p>
                  ) : (
                    <ol className="grid gap-2 text-[13px]">
                      {data.data?.history.map((h) => (
                        <li key={h.id}>
                          <span className="text-muted">{fmtDate(h.changedAt, locale, true)}</span>
                          <span className="ml-2">
                            {h.from ? t.caseStatus[h.from] : "—"} → <strong>{t.caseStatus[h.to]}</strong>
                          </span>
                          {h.note && <span className="block text-[12px] text-muted">{h.note}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>
            </div>

            <Modal open={removeMode !== null} title={removeMode === "delete" ? t.detail.remove : t.detail.hide} onClose={() => setRemoveMode(null)}>
              <p className="text-[14px] font-semibold">
                {inq.receiptNo} · {inq.requester.name}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{removeMode === "delete" ? t.detail.removeLead : t.detail.hideConfirm}</p>
              {removeMode === "delete" && (
                <div className="mt-4">
                  <Field label={t.detail.removeConfirmLabel(inq.receiptNo)} htmlFor="d-remove-confirm">
                    <input id="d-remove-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={inputClass} />
                  </Field>
                </div>
              )}
              {removeError && (
                <p role="alert" className="mt-3 rounded-control border border-[#f2a7a7] bg-[#fdeeee] p-3 text-[13px]">
                  {t.detail.removeFailed}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={doRemove}
                  disabled={removeBusy || (removeMode === "delete" && confirmText.trim() !== inq.receiptNo)}
                  className={removeMode === "delete" ? `${buttonDanger} disabled:cursor-not-allowed disabled:opacity-50` : buttonPrimary}
                >
                  {removeMode === "delete" ? t.detail.removeButton : t.detail.hide}
                </button>
                <button type="button" onClick={() => setRemoveMode(null)} className={buttonSecondary}>
                  {t.common.cancel}
                </button>
              </div>
            </Modal>

            <Modal open={preview} title={t.detail.preview} onClose={() => setPreview(false)}>
              <p className="text-[12px] text-muted">To: {inq.requester.email}</p>
              <p className="mt-2 text-[15px] font-bold">{subject}</p>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{body}</p>
              <div className="mt-4">
                <NotConnected>{t.detail.sendNotConnected}</NotConnected>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={send} className={buttonPrimary}>
                  {t.detail.send}
                </button>
                <button type="button" onClick={() => setPreview(false)} className={buttonSecondary}>
                  {t.common.cancel}
                </button>
              </div>
            </Modal>
          </>
        )}
      </LoadState>
    </>
  );
}
