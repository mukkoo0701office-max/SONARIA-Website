"use client";

// 案件詳細の「料金・お支払い」。請求先・受付時の計算・確定金額・決済の記録を 1 か所で見る。
// 金額の確定はデータベースの関数（admin_confirm_price）が検証する（決済済みは変更不可・古い請求は取り消し）。
// カード決済のリンク作成は Phase 3（Stripe テストモードの設定後）。それまでは押せない状態で表示する
import { useEffect, useState } from "react";
import { useAdmin, useAdminData } from "../../AdminContext";
import type { Currency, Inquiry, PaymentRecordStatus } from "../../types";
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
  const mismatch = b.region && b.regionDetected && (b.region === "jp") !== (b.regionDetected === "JP");

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
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-[13px]">
                <span>
                  {p.purpose[r.purpose]}・{p.methodOptions[r.method]}
                  {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{money(r.receivedAmount ?? r.amount, r.currency)}</span>
                  <Badge tone={statusTone[r.status]}>{p.status[r.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" disabled className={`${buttonSecondary} mt-3`}>
            {p.stripeLink}
          </button>
          <NotConnected>{p.stripeNotConnected}</NotConnected>
        </section>
      </div>
    </Card>
  );
}
