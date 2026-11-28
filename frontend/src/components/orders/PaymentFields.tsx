"use client";

import type { getDictionary } from "@/data/dictionaries";
import type { Region } from "@/lib/orders/priceEngine";

type T = ReturnType<typeof getDictionary>["orderForm"];
export type PaymentMethod = "card" | "bank_transfer";

const optionBase = "flex cursor-pointer items-start gap-3 rounded-control border p-3 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy";
const optionOn = "border-navy bg-navy/5";
const optionOff = "border-muted bg-card hover:bg-subtle";

// 料金の区分（自動判定の結果を伝えるだけ。選ぶ欄は置かない）と支払い方法。銀行振込は日本と判定できたときだけ表示する
export default function PaymentFields({ t, region, method, onMethod, notes }: { t: T; region: Region | null; method: PaymentMethod; onMethod: (m: PaymentMethod) => void; notes?: { card: string; bank: string } }) {
  const cardNote = notes?.card ?? t.payment.cardNote;
  const bankNote = notes?.bank ?? t.payment.bankNote;
  const bank = region === "jp";
  return (
    <div className="grid gap-4 rounded-card border border-line bg-card p-5 sm:p-6">
      <div>
        <p className="text-[15px] font-bold">
          {t.billing.heading}: {region ? t.billing.options[region] : `${t.billing.options.jp}（${t.billing.provisional}）`}
        </p>
        <p className="mt-1 text-[13px] text-muted">{region ? t.billing.autoNote : t.billing.unknownNote}</p>
      </div>
      <fieldset className="min-w-0">
        <legend className="text-[15px] font-bold">{t.payment.heading}</legend>
        {bank ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(["card", "bank_transfer"] as const).map((m) => (
              <label key={m} className={`${optionBase} ${method === m ? optionOn : optionOff}`}>
                <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => onMethod(m)} className="mt-0.5 accent-navy" />
                <span className="font-bold">{t.payment.options[m]}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[14px]">{t.payment.options.card}</p>
        )}
        <p className="mt-2 text-[13px] text-muted">{bank && method === "bank_transfer" ? bankNote : bank ? cardNote : region === "intl" ? `${t.payment.intlNote} ${cardNote}` : cardNote}</p>
      </fieldset>
    </div>
  );
}
