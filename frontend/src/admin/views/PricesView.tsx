"use client";

// 料金マスタ（public.price_items）。改定は新しい行を足し、有効開始日から切り替わる。過去の行は書き換えない。
// 申込フォームの表示とサーバーの計算（受付時）はこの料金を使う（docs/payments/PAYMENTS_DESIGN.md）
import { useMemo, useState } from "react";
import { useAdmin, useAdminData } from "../AdminContext";
import type { PriceItem } from "../types";
import { Badge, buttonPrimary, Card, Field, inputClass, LoadState, PageTitle, Table } from "../ui";

const todayTokyo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const yen = (n: number | null) => (n == null ? null : `¥${n.toLocaleString("en-US")}`);
const usd = (n: number | null) => (n == null ? null : `$${(n / 100).toFixed(2)}`);

// 有効開始日が今日以前で最も新しい行 = 現在の料金
function currentOf(rows: PriceItem[], today: string): PriceItem[] {
  const map = new Map<string, PriceItem>();
  for (const r of rows) {
    if (r.effectiveFrom > today) continue;
    const k = `${r.service}:${r.item}`;
    const prev = map.get(k);
    if (!prev || r.effectiveFrom > prev.effectiveFrom) map.set(k, r);
  }
  return [...map.values()].sort((a, b) => a.service.localeCompare(b.service) || a.item.localeCompare(b.item));
}

export default function PricesView() {
  const { t, repo } = useAdmin();
  const p = t.prices;
  const data = useAdminData((r) => r.listPrices(), []);
  const rows = data.data ?? [];
  const today = todayTokyo();
  const current = useMemo(() => currentOf(rows, today), [rows, today]);
  const scheduled = rows.filter((r) => r.effectiveFrom > today);

  const [form, setForm] = useState({ key: "", jpy: "", usd: "", from: "", active: true, note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = current.find((r) => `${r.service}:${r.item}` === form.key);

  const label = (r: PriceItem) => `${p.services[r.service] ?? r.service} / ${p.items[r.item] ?? r.item}`;
  const amount = (v: string, cents: boolean): number | null | "bad" => {
    const s = v.trim();
    if (!s) return null;
    if (cents) return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : "bad";
    return /^\d+$/.test(s) ? Number(s) : "bad";
  };

  async function save() {
    if (!repo || !selected) return;
    const jpy = amount(form.jpy, false);
    const usdCents = amount(form.usd, true);
    if (jpy === "bad" || usdCents === "bad" || !form.from) return;
    if (form.from < today) {
      setMsg({ ok: false, text: p.errorPast });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await repo.addPrice({ service: selected.service, item: selected.item, mode: selected.mode, jpy, usdCents, effectiveFrom: form.from, active: form.active, note: form.note.trim() || undefined });
      setMsg({ ok: true, text: p.saved });
      setForm((f) => ({ ...f, note: "" }));
      data.reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setMsg({ ok: false, text: m.includes("past_effective_date") ? p.errorPast : m.includes("effective_today_locked") ? p.errorLocked : t.pay.errorGeneric });
    } finally {
      setBusy(false);
    }
  }

  function pick(key: string) {
    const r = current.find((x) => `${x.service}:${x.item}` === key);
    setForm({ key, jpy: r?.jpy != null ? String(r.jpy) : "", usd: r?.usdCents != null ? (r.usdCents / 100).toFixed(2) : "", from: "", active: r?.active ?? true, note: "" });
    setMsg(null);
  }

  return (
    <>
      <PageTitle title={p.title} lead={p.lead} />
      <LoadState status={data.status} empty={rows.length === 0} onRetry={data.reload}>
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid min-w-0 gap-4">
            <Card title={p.current}>
              <Table
                head={
                  <tr>
                    <th scope="col">{p.service} / {p.item}</th>
                    <th scope="col">{p.mode}</th>
                    <th scope="col" className="text-right">{p.jpy}</th>
                    <th scope="col" className="text-right">{p.usd}</th>
                    <th scope="col">{p.from}</th>
                  </tr>
                }
              >
                {current.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {label(r)} {!r.active && <Badge tone="neutral">{p.inactive}</Badge>}
                    </td>
                    <td>{p.modes[r.mode]}</td>
                    <td className="text-right tabular-nums">{yen(r.jpy) ?? <span className="text-muted">{p.none}</span>}</td>
                    <td className="text-right tabular-nums">{usd(r.usdCents) ?? <span className="text-muted">{p.none}</span>}</td>
                    <td className="tabular-nums">{r.effectiveFrom}</td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card title={p.history}>
              <Table
                head={
                  <tr>
                    <th scope="col">{p.service} / {p.item}</th>
                    <th scope="col" className="text-right">{p.jpy}</th>
                    <th scope="col" className="text-right">{p.usd}</th>
                    <th scope="col">{p.from}</th>
                    <th scope="col">{p.active}</th>
                  </tr>
                }
              >
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {label(r)}
                      {r.effectiveFrom > today && scheduled.includes(r) && <> <Badge tone="info">{r.effectiveFrom}〜</Badge></>}
                      {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                    </td>
                    <td className="text-right tabular-nums">{yen(r.jpy) ?? "—"}</td>
                    <td className="text-right tabular-nums">{usd(r.usdCents) ?? "—"}</td>
                    <td className="tabular-nums">{r.effectiveFrom}</td>
                    <td>{r.active ? p.active : p.inactive}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
          <Card title={p.add}>
            <div className="grid gap-3">
              <p className="text-[12px] text-muted">{p.addHelp}</p>
              <Field label={`${p.service} / ${p.item}`} htmlFor="pr-key">
                <select id="pr-key" value={form.key} onChange={(e) => pick(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {current.filter((r) => r.mode !== "quote").map((r) => (
                    <option key={r.id} value={`${r.service}:${r.item}`}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              </Field>
              {selected && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={p.jpy} htmlFor="pr-jpy">
                      <input id="pr-jpy" inputMode="numeric" value={form.jpy} onChange={(e) => setForm((f) => ({ ...f, jpy: e.target.value }))} placeholder={p.none} className={inputClass} />
                    </Field>
                    <Field label={p.usd} htmlFor="pr-usd">
                      <input id="pr-usd" inputMode="decimal" value={form.usd} onChange={(e) => setForm((f) => ({ ...f, usd: e.target.value }))} placeholder={p.none} className={inputClass} />
                    </Field>
                  </div>
                  <Field label={p.from} htmlFor="pr-from">
                    <input id="pr-from" type="date" min={today} value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} className={inputClass} />
                  </Field>
                  <label className="flex items-center gap-2 text-[14px]">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 accent-navy" />
                    {p.active}
                  </label>
                  <Field label={t.pay.note} htmlFor="pr-note">
                    <input id="pr-note" value={form.note} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} />
                  </Field>
                  <button type="button" disabled={busy || !form.from} onClick={save} className={buttonPrimary}>
                    {p.save}
                  </button>
                </>
              )}
              {msg && (
                <p role={msg.ok ? "status" : "alert"} className={`rounded-control border px-3 py-2 text-[13px] ${msg.ok ? "border-[#9fd9a9] bg-[#eefaf0]" : "border-[#e0a0a0] bg-[#fdeeee]"}`}>
                  {msg.text}
                </p>
              )}
            </div>
          </Card>
        </div>
      </LoadState>
    </>
  );
}
