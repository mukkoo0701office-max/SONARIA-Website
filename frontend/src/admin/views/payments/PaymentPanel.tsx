"use client";

// 案件詳細の「料金・お支払い」。請求先・受付時の計算・確定金額・決済の記録を 1 か所で見る。
// 金額の確定はデータベースの関数（admin_confirm_price）が検証する（決済済みは変更不可・古い請求は取り消し）。
// カード決済のリンク作成は Phase 3（Stripe テストモードの設定後）。それまでは押せない状態で表示する。
// 銀行振込（日本・円のみ）は管理人が手動で記録する: 案内を送った → 着金（金額・日付）→ 必要なら返金（Phase 4）
import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../../AdminContext";
import type { Currency, Inquiry, PaymentRecord, PaymentRecordStatus } from "../../types";
import { Badge, buttonPrimary, buttonSecondary, Card, Field, inputClass, NotConnected } from "../../ui";
import type { Tone } from "../../theme";

const money = (amount: number, currency: Currency) =>
  currency === "JPY" ? `¥${amount.toLocaleString("en-US")}` : `$${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 入力（円は整数、ドルは小数 2 桁まで）→ 最小単位
function parseAmount(v: string, currency: Currency): number | null {
  const s = v.trim().replace(/[,¥$\s]/g, "");
  if (!s) return null;
  if (currency === "JPY") return /^\d+$/.test(s) ? Number(s) : null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
const toInput = (amount: number, currency: Currency) => (currency === "JPY" ? String(amount) : (amount / 100).toFixed(2));

const statusTone: Record<PaymentRecordStatus, Tone> = {
  pending: "neutral",
  link_sent: "warn",
  paid: "good",
  underpaid: "warn",
  overpaid: "warn",
  failed: "warn",
  expired: "neutral",
  cancelled: "neutral",
  partially_refunded: "info",
  refunded: "info",
  disputed: "warn",
};

export default function PaymentPanel({ inquiry, onChanged }: { inquiry: Inquiry; onChanged: () => void }) {
  const { t, repo } = useAdmin();
  const p = t.pay;
  const b = inquiry.billing ?? {};
  const payments = useAdminData((r) => r.listPayments(inquiry.id), [inquiry.id, inquiry.billing?.confirmed?.at]);

  const q = b.serverQuote;
  const defaultCurrency: Currency = b.confirmed?.currency ?? (q && q.ok ? q.currency : b.currency) ?? "JPY";
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setCurrency(defaultCurrency);
    setAmount(b.confirmed ? toInput(b.confirmed.amount, b.confirmed.currency) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry.id, b.confirmed?.at]);

  const parsed = parseAmount(amount, currency);
  // 自動判定の 2 つの手がかり（アクセス元の国と端末のタイムゾーン）が食い違うときは、請求の前に確認を促す
  const mismatch = b.regionGuess && b.regionDetected && (b.regionGuess === "jp") !== (b.regionDetected === "JP");

  async function confirm() {
    if (!repo || parsed == null || parsed < 1) return;
    setBusy(true);
    setMessage(null);
    try {
      await repo.confirmPrice(inquiry.id, parsed, currency, note.trim() || undefined);
      setNote("");
      setMessage({ ok: true, text: p.confirmedFlash });
      onChanged();
    } catch (e) {
      const text = e instanceof Error && e.message.includes("already_paid") ? p.errorAlreadyPaid : p.errorGeneric;
      setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={p.title} id="d-payment">
      <div className="grid gap-4 text-[14px]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-muted">{p.region}</dt>
          <dd>{b.region ? p.regionOptions[b.region] : p.regionUnknown}</dd>
          {b.regionDetected && (
            <>
              <dt className="text-muted">{p.detected}</dt>
              <dd>{b.regionDetected}</dd>
            </>
          )}
          {b.regionGuess && (
            <>
              <dt className="text-muted">{p.guess}</dt>
              <dd>{p.regionOptions[b.regionGuess]}</dd>
            </>
          )}
          {b.paymentMethod && (
            <>
              <dt className="text-muted">{p.method}</dt>
              <dd>{p.methodOptions[b.paymentMethod]}</dd>
            </>
          )}
        </dl>
        {mismatch && (
          <p role="note" className="rounded-control border border-[#e0b85c] bg-[#fff8e6] px-3 py-2 text-[13px]">
            ⚠ {p.regionMismatch}
          </p>
        )}

        <section aria-labelledby="pay-server-quote">
          <h3 id="pay-server-quote" className="text-[13px] font-bold">{p.serverQuote}</h3>
          {!q ? (
            <p className="mt-1 text-[13px] text-muted">{p.noQuote}</p>
          ) : q.ok ? (
            <div className="mt-1">
              <ul className="grid gap-0.5 text-[13px]">
                {q.lines.map((l) => (
                  <li key={l.item} className="flex justify-between gap-2">
                    <span>{t.prices.items[l.item] ?? l.item} × {l.quantity}</span>
                    <span className="tabular-nums">{money(l.subtotal, q.currency)}</span>
                  </li>
                ))}
              </ul>
              {q.factorTenths !== 10 && <p className="text-[12px] text-muted">{p.factor((q.factorTenths / 10).toFixed(1))}</p>}
              <p className="mt-1 flex justify-between font-bold">
                <span>{t.common.total ?? "Total"}</span>
                <span className="tabular-nums">{money(q.total, q.currency)}</span>
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[13px]">{q.reason === "quote_required" ? p.quoteRequired : p.quoteUnavailable}</p>
          )}
        </section>

        <section aria-labelledby="pay-confirmed" className="border-t border-line pt-3">
          <h3 id="pay-confirmed" className="text-[13px] font-bold">{p.confirmed}</h3>
          <p className="mt-1 text-[16px] font-bold tabular-nums">{b.confirmed ? money(b.confirmed.amount, b.confirmed.currency) : <span className="text-[14px] font-normal text-muted">{p.notConfirmed}</span>}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] text-navy underline">{p.confirmTitle}</summary>
            <div className="mt-2 grid gap-3">
              <p className="text-[12px] text-muted">{p.confirmHelp}</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label={p.amount} htmlFor="pay-amount">
                  <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={amount !== "" && parsed == null} className={inputClass} />
                </Field>
                <Field label={p.currency} htmlFor="pay-currency">
                  <select id="pay-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputClass}>
                    <option value="JPY">JPY</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
              {q && q.ok && (
                <button type="button" className={`${buttonSecondary} justify-self-start`} onClick={() => { setCurrency(q.currency); setAmount(toInput(q.total, q.currency)); }}>
                  {p.useServerQuote}（{money(q.total, q.currency)}）
                </button>
              )}
              <Field label={p.note} htmlFor="pay-note">
                <input id="pay-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={inputClass} />
              </Field>
              <button type="button" disabled={busy || parsed == null || parsed < 1} onClick={confirm} className={buttonPrimary}>
                {p.confirm}
              </button>
            </div>
          </details>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`mt-2 rounded-control border px-3 py-2 text-[13px] ${message.ok ? "border-[#9fd9a9] bg-[#eefaf0]" : "border-[#e0a0a0] bg-[#fdeeee]"}`}>
              {message.text}
            </p>
          )}
        </section>

        <section aria-labelledby="pay-records" className="border-t border-line pt-3">
          <h3 id="pay-records" className="text-[13px] font-bold">{p.payments}</h3>
          {payments.status === "ready" && (payments.data ?? []).length === 0 && <p className="mt-1 text-[13px] text-muted">{p.noPayments}</p>}
          <ul className="mt-1 grid gap-1.5">
            {(payments.data ?? []).map((r) => (
              <li key={r.id} className="rounded-control border border-line px-3 py-2 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {p.purpose[r.purpose]}・{p.methodOptions[r.method]}
                    {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{money(r.amount, r.currency)}</span>
                    <Badge tone={statusTone[r.status]}>{p.status[r.status]}</Badge>
                  </span>
                </div>
                {r.method === "bank_transfer" && <BankRow r={r} onChanged={() => { payments.reload(); onChanged(); }} />}
              </li>
            ))}
          </ul>
          {b.confirmed?.currency === "JPY" && <BankNotice inquiryId={inquiry.id} hasOpen={(payments.data ?? []).some((r) => r.method === "bank_transfer" && ["pending", "link_sent", "underpaid"].includes(r.status))} onChanged={() => { payments.reload(); onChanged(); }} />}
          <button type="button" disabled className={`${buttonSecondary} mt-3`}>
            {p.stripeLink}
          </button>
          <NotConnected>{p.stripeNotConnected}</NotConnected>
        </section>
      </div>
    </Card>
  );
}

const todayTokyo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const fmtDate = (iso?: string) => (iso ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "");

// 1 操作ごとに ID を作り、通信の再試行・二重クリックでも記録が 1 回になるようにする（サーバーの request_id）
function useRequestId() {
  const [id, setId] = useState(() => crypto.randomUUID());
  return [id, () => setId(crypto.randomUUID())] as const;
}

function Flash({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={`mt-2 rounded-control border px-3 py-2 text-[13px] ${message.ok ? "border-[#9fd9a9] bg-[#eefaf0]" : "border-[#e0a0a0] bg-[#fdeeee]"}`}>
      {message.text}
    </p>
  );
}

// 振込案内を送ったことの記録。メールを実際に送ったあとに押す（コピー・メールアプリを開いただけでは記録しない）
function BankNotice({ inquiryId, hasOpen, onChanged }: { inquiryId: string; hasOpen: boolean; onChanged: () => void }) {
  const { t, repo } = useAdmin();
  const p = t.pay;
  const [requestId, nextRequest] = useRequestId();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function record() {
    if (!repo) return;
    setBusy(true);
    setMessage(null);
    try {
      await repo.recordBankNotice(inquiryId, requestId);
      nextRequest();
      setSent(false);
      setMessage({ ok: true, text: p.bank.noticeFlash });
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error && e.message.includes("already_paid") ? p.errorAlreadyPaid : p.errorGeneric });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 rounded-control border border-line bg-paper p-3">
      <p className="text-[13px] font-bold">{hasOpen ? p.bank.renoticeTitle : p.bank.noticeTitle}</p>
      <p className="mt-1 text-[12px] text-muted">{p.bank.noticeHelp}</p>
      <label className="mt-2 flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} className="mt-0.5 accent-navy" />
        <span>{p.bank.sentCheck}</span>
      </label>
      <button type="button" disabled={!sent || busy} onClick={record} className={`${buttonSecondary} mt-2`}>
        {p.bank.noticeButton}
      </button>
      <Flash message={message} />
    </div>
  );
}

// 振込 1 件の操作: 着金の記録・返金の記録・取り消し
function BankRow({ r, onChanged }: { r: PaymentRecord; onChanged: () => void }) {
  const { t, repo } = useAdmin();
  const p = t.pay;
  const received = r.receivedAmount ?? 0;
  const remaining = Math.max(r.amount - received, 0);
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [date, setDate] = useState(todayTokyo());
  const [refund, setRefund] = useState(received > r.amount ? String(received - r.amount - r.refundedAmount) : "");
  const [note, setNote] = useState("");
  const [requestId, nextRequest] = useRequestId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      nextRequest();
      setNote("");
      setMessage({ ok: true, text: ok });
      onChanged();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setMessage({ ok: false, text: m.includes("invalid_date") ? p.bank.errorDate : m.includes("invalid_amount") ? p.bank.errorAmount : p.errorGeneric });
    } finally {
      setBusy(false);
    }
  }
  const receiptAmount = Number(amount.replace(/[,¥\s]/g, ""));
  const refundAmount = Number(refund.replace(/[,¥\s]/g, ""));
  const canReceive = ["pending", "link_sent", "underpaid", "paid", "overpaid"].includes(r.status);
  const canRefund = ["paid", "underpaid", "overpaid", "partially_refunded"].includes(r.status) && received - r.refundedAmount > 0;
  const canCancel = r.status === "pending" || r.status === "link_sent";

  return (
    <div className="mt-2 grid gap-2 border-t border-line pt-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
        {r.notifiedAt && (<><dt className="text-muted">{p.bank.notifiedAt}</dt><dd>{fmtDate(r.notifiedAt)}</dd></>)}
        <dt className="text-muted">{p.bank.received}</dt>
        <dd className="tabular-nums">{money(received, r.currency)}{r.paidAt ? `（${fmtDate(r.paidAt)}）` : ""}</dd>
        {remaining > 0 && received > 0 && (<><dt className="text-muted">{p.bank.shortfall}</dt><dd className="tabular-nums">{money(remaining, r.currency)}</dd></>)}
        {received > r.amount && (<><dt className="text-muted">{p.bank.excess}</dt><dd className="tabular-nums">{money(received - r.amount, r.currency)}</dd></>)}
        {r.refundedAmount > 0 && (<><dt className="text-muted">{p.bank.refunded}</dt><dd className="tabular-nums">{money(r.refundedAmount, r.currency)}</dd></>)}
      </dl>
      {canReceive && (
        <details>
          <summary className="cursor-pointer text-[13px] text-navy underline">{p.bank.receiptTitle}</summary>
          <div className="mt-2 grid gap-2">
            <p className="text-[12px] text-muted">{p.bank.receiptHelp}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={p.bank.receiptAmount} htmlFor={`bank-amt-${r.id}`}>
                <input id={`bank-amt-${r.id}`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
              </Field>
              <Field label={p.bank.receiptDate} htmlFor={`bank-date-${r.id}`}>
                <input id={`bank-date-${r.id}`} type="date" max={todayTokyo()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label={p.note} htmlFor={`bank-note-${r.id}`}>
              <input id={`bank-note-${r.id}`} value={note} maxLength={500} placeholder={p.bank.notePlaceholder} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </Field>
            <button type="button" disabled={busy || !Number.isInteger(receiptAmount) || receiptAmount < 1 || !date} className={buttonPrimary}
              onClick={() => run(() => repo!.recordBankReceipt(r.id, receiptAmount, date, requestId, note.trim() || undefined), p.bank.receiptFlash)}>
              {p.bank.receiptButton}
            </button>
          </div>
        </details>
      )}
      {canRefund && (
        <details>
          <summary className="cursor-pointer text-[13px] text-navy underline">{p.bank.refundTitle}</summary>
          <div className="mt-2 grid gap-2">
            <p className="text-[12px] text-muted">{p.bank.refundHelp}</p>
            <Field label={p.bank.refundAmount} htmlFor={`bank-ref-${r.id}`}>
              <input id={`bank-ref-${r.id}`} inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value)} className={inputClass} />
            </Field>
            <Field label={p.note} htmlFor={`bank-rnote-${r.id}`}>
              <input id={`bank-rnote-${r.id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </Field>
            <button type="button" disabled={busy || !Number.isInteger(refundAmount) || refundAmount < 1} className={buttonSecondary}
              onClick={() => run(() => repo!.recordBankRefund(r.id, refundAmount, requestId, note.trim() || undefined), p.bank.refundFlash)}>
              {p.bank.refundButton}
            </button>
          </div>
        </details>
      )}
      {canCancel && (
        <button type="button" disabled={busy} className={`${buttonSecondary} justify-self-start`}
          onClick={() => { if (window.confirm(p.bank.cancelConfirm)) run(() => repo!.cancelPayment(r.id), p.bank.cancelFlash); }}>
          {p.bank.cancelButton}
        </button>
      )}
      <Flash message={message} />
    </div>
  );
}
