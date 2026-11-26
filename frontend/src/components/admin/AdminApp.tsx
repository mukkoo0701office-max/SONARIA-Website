"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { allFields, applicationStatuses, serviceDefs, type ApplicationStatus, type ServiceId } from "@shared/schema";
import { formsJa } from "@/data/dictionaries/forms/ja";
import { BUCKET, backendConfigured, getSupabase } from "@/lib/backend";

// 管理人専用ダッシュボード（日本語のみ）。
// ログインは Supabase Auth。データの保護は RLS（admins テーブルに登録された人だけが読める）で行う。

type Application = {
  id: string;
  receipt_no: string;
  service: string;
  status: ApplicationStatus;
  locale: string;
  name: string;
  email: string;
  phone: string | null;
  payload: Record<string, unknown>;
  quote: Record<string, unknown> | null;
  admin_note: string | null;
  notify_admin_status: string;
  notify_applicant_status: string;
  redacted_at: string | null;
  created_at: string;
  updated_at: string;
};

type FileRow = { id: string; storage_path: string; original_name: string; mime: string; size_bytes: number; uploaded: boolean };
type History = { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string };

const serviceLabels: Record<string, string> = {
  lesson: "レッスン",
  bowing: "運指・ボウイング",
  recording: "レコーディング",
  performance: "演奏依頼",
  contact: "お問い合わせ",
};

const statusLabels: Record<ApplicationStatus, string> = {
  new: "新規受付",
  reviewing: "内容確認中",
  quoted: "見積もり送付済み",
  awaiting_reply: "依頼者回答待ち",
  in_progress: "対応中",
  completed: "完了",
  cancelled: "キャンセル",
};

const notifyLabels: Record<string, string> = {
  pending: "未処理",
  sent: "送信済み",
  failed: "失敗",
  not_configured: "未接続",
  disabled: "停止中",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

// 入力項目のラベル（フォームの日本語の文言を流用する）
function fieldLabel(service: string, key: string): string {
  const copy = (formsJa as unknown as Record<string, { fields?: Record<string, { label: string }> }>)[service];
  return copy?.fields?.[key]?.label ?? key;
}

function fieldValue(service: string, key: string, v: unknown): string {
  const copy = (formsJa as unknown as Record<string, { fields?: Record<string, { options?: Record<string, string> }> }>)[service];
  const opts = copy?.fields?.[key]?.options;
  if (service === "lesson" && key === "plan" && typeof v === "string") {
    const p = formsJa.lesson.plans[v as keyof typeof formsJa.lesson.plans];
    return p ? `${p.name}（${p.detail}）` : v;
  }
  if (Array.isArray(v)) return v.map((x) => opts?.[String(x)] ?? String(x)).join("、");
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  if (typeof v === "string") return opts?.[v] ?? v.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/, "$1 $2");
  return v === null || v === undefined ? "" : String(v);
}

// 申し込み内容をフォームと同じ順番に並べる（定義にない項目は最後）
function orderedEntries(service: string, payload: Record<string, unknown>): [string, unknown][] {
  const def = serviceDefs[service as ServiceId];
  const order = def ? allFields(def).map((f) => f.key) : [];
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return Object.entries(payload).sort(([a], [b]) => rank(a) - rank(b));
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminApp() {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !session) {
      setIsAdmin(null);
      return;
    }
    sb.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [sb, session]);

  if (!backendConfigured || !sb) {
    return (
      <Shell>
        <div className="rounded-card border-2 border-dashed border-muted bg-card p-6 text-sm leading-relaxed">
          <p className="font-semibold">バックエンドが未接続です</p>
          <p className="mt-2">
            Supabase の URL と公開キー（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が設定されていません。設定手順は docs/setup-backend.md を参照してください。
          </p>
        </div>
      </Shell>
    );
  }

  if (!session) return <Shell><Login /></Shell>;

  if (isAdmin === false) {
    return (
      <Shell onSignOut={() => sb.auth.signOut()}>
        <p className="rounded-card border border-line bg-card p-6 text-sm">このアカウントには管理権限がありません。</p>
      </Shell>
    );
  }
  if (isAdmin === null) return <Shell><p className="text-sm text-muted">確認しています…</p></Shell>;

  return (
    <Shell onSignOut={() => sb.auth.signOut()} email={session.user.email}>
      <Dashboard />
    </Shell>
  );
}

function Shell({ children, onSignOut, email }: { children: React.ReactNode; onSignOut?: () => void; email?: string }) {
  return (
    <div className="mx-auto max-w-wide px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <span className="font-brand text-2xl tracking-[0.06em] text-navy">SONARIA</span>
          <span className="ml-3 text-sm text-muted">管理画面</span>
        </div>
        {onSignOut && (
          <div className="flex items-center gap-3 text-[13px]">
            {email && <span className="text-muted">{email}</span>}
            <button type="button" onClick={onSignOut} className="rounded-button border border-line bg-card px-3 py-2 text-navy">
              ログアウト
            </button>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

function Login() {
  const sb = getSupabase()!;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mx-auto mt-10 grid max-w-sm gap-4 rounded-card border border-line bg-card p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (err) setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
      }}
    >
      <h1 className="text-lg font-bold">管理人ログイン</h1>
      <label className="grid gap-1.5 text-[13px] font-semibold">
        メールアドレス
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-control border border-muted p-3 font-normal" />
      </label>
      <label className="grid gap-1.5 text-[13px] font-semibold">
        パスワード
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-control border border-muted p-3 font-normal" />
      </label>
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-button bg-navy p-3 text-[14px] font-semibold text-white disabled:opacity-50">
        {busy ? "確認しています…" : "ログイン"}
      </button>
    </form>
  );
}

function Dashboard() {
  const sb = getSupabase()!;
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState("all");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await sb.from("applications").select("*").order("created_at", { ascending: false }).limit(1000);
    setLoading(false);
    if (err) setError(err.message);
    else setRows((data ?? []) as Application[]);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (service !== "all" && r.service !== service) return false;
      if (status === "open" && (r.status === "completed" || r.status === "cancelled")) return false;
      if (status !== "open" && status !== "all" && r.status !== status) return false;
      if (needle) {
        const hay = [r.receipt_no, r.name, r.email, r.phone ?? "", JSON.stringify(r.payload)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, service, status, q]);

  const newCount = rows.filter((r) => r.status === "new").length;
  const openCount = rows.filter((r) => r.status !== "completed" && r.status !== "cancelled").length;

  function exportCsv() {
    const header = ["受付番号", "受付日時", "種類", "状態", "氏名", "メール", "電話", "料金の目安", "内容", "管理メモ"];
    const lines = filtered.map((r) =>
      [r.receipt_no, fmt(r.created_at), serviceLabels[r.service] ?? r.service, statusLabels[r.status], r.name, r.email, r.phone, r.quote?.totalYen ?? r.quote?.yen ?? "", r.payload, r.admin_note]
        .map(csvEscape)
        .join(","),
    );
    // Excel で文字化けしないよう BOM を付ける
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sonaria-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="新規受付" value={newCount} />
        <Stat label="未完了" value={openCount} />
        <Stat label="全件" value={rows.length} />
        <TaxSetting />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4">
        <label className="grid gap-1 text-[12px] font-semibold">
          種類
          <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-control border border-muted p-2 font-normal">
            <option value="all">すべて</option>
            {Object.entries(serviceLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-semibold">
          状態
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-control border border-muted p-2 font-normal">
            <option value="open">未完了</option>
            <option value="all">すべて</option>
            {applicationStatuses.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-[12px] font-semibold">
          検索（受付番号・氏名・メール・内容）
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-control border border-muted p-2 font-normal" />
        </label>
        <button type="button" onClick={load} className="rounded-button border border-line bg-card px-3 py-2 text-[13px] text-navy">再読み込み</button>
        <button type="button" onClick={exportCsv} className="rounded-button border border-navy bg-navy px-3 py-2 text-[13px] text-white">CSV 書き出し</button>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="overflow-hidden rounded-card border border-line bg-card">
          {loading ? (
            <p className="p-4 text-sm text-muted">読み込んでいます…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted">該当する申し込みはありません。</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    aria-current={selected?.id === r.id ? "true" : undefined}
                    className={selected?.id === r.id ? "block w-full bg-paper p-3 text-left" : "block w-full p-3 text-left hover:bg-paper"}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-mono font-semibold text-navy">{r.receipt_no}</span>
                      <span className="rounded-tag bg-subtle px-1.5 py-0.5 text-[11px]">{serviceLabels[r.service] ?? r.service}</span>
                      <span className={r.status === "new" ? "rounded-tag bg-navy px-1.5 py-0.5 text-[11px] text-white" : "rounded-tag border border-line px-1.5 py-0.5 text-[11px]"}>
                        {statusLabels[r.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-[13px]">
                      <span>{r.name}</span>
                      <span className="text-muted">{fmt(r.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>{selected ? <Detail key={selected.id} app={selected} onChanged={load} /> : <p className="text-sm text-muted">左の一覧から申し込みを選んでください。</p>}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

// 運指・ボウイング料金の税の扱い（公開設定）
function TaxSetting() {
  const sb = getSupabase()!;
  const [value, setValue] = useState<string>("undecided");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    sb.from("settings").select("value").eq("key", "bowing_tax_mode").single().then(({ data }) => {
      if (typeof data?.value === "string") setValue(data.value);
    });
  }, [sb]);
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <label className="grid gap-1 text-[12px] text-muted">
        運指・ボウイング料金の税
        <select
          value={value}
          onChange={async (e) => {
            const v = e.target.value;
            setValue(v);
            const { error } = await sb.from("settings").update({ value: v }).eq("key", "bowing_tax_mode");
            setMsg(error ? "保存できませんでした" : "保存しました");
          }}
          className="rounded-control border border-muted p-1.5 text-[13px] text-ink"
        >
          <option value="undecided">確認後に案内</option>
          <option value="included">税込</option>
          <option value="excluded">税抜</option>
        </select>
      </label>
      {msg && <p className="mt-1 text-[11px] text-muted" role="status">{msg}</p>}
    </div>
  );
}

function Detail({ app, onChanged }: { app: Application; onChanged: () => void }) {
  const sb = getSupabase()!;
  const [files, setFiles] = useState<FileRow[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>(app.status);
  const [statusNote, setStatusNote] = useState("");
  const [adminNote, setAdminNote] = useState(app.admin_note ?? "");
  const [msg, setMsg] = useState("");
  const [confirmRedact, setConfirmRedact] = useState("");

  const loadExtras = useCallback(async () => {
    const [{ data: f }, { data: h }] = await Promise.all([
      sb.from("application_files").select("*").eq("application_id", app.id),
      sb.from("application_status_history").select("*").eq("application_id", app.id).order("created_at"),
    ]);
    setFiles((f ?? []) as FileRow[]);
    setHistory((h ?? []) as History[]);
  }, [sb, app.id]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  async function saveStatus() {
    const { error } = await sb.rpc("admin_set_status", { p_id: app.id, p_status: nextStatus, p_note: statusNote });
    setMsg(error ? `保存できませんでした: ${error.message}` : "状態を変更しました");
    if (!error) {
      setStatusNote("");
      onChanged();
      loadExtras();
    }
  }

  async function saveNote() {
    const { error } = await sb.from("applications").update({ admin_note: adminNote }).eq("id", app.id);
    setMsg(error ? `保存できませんでした: ${error.message}` : "メモを保存しました");
    if (!error) onChanged();
  }

  async function download(file: FileRow) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(file.storage_path, 60, { download: file.original_name });
    if (error || !data) setMsg("ダウンロード用のリンクを作れませんでした");
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function redact() {
    if (files.length) await sb.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
    const { error } = await sb.rpc("admin_redact_application", { p_id: app.id });
    setMsg(error ? `削除できませんでした: ${error.message}` : "個人情報と添付ファイルを削除しました");
    setConfirmRedact("");
    if (!error) {
      onChanged();
      loadExtras();
    }
  }

  return (
    <article className="grid gap-5 rounded-card border border-line bg-card p-5">
      <header>
        <p className="font-mono text-lg font-bold text-navy">{app.receipt_no}</p>
        <p className="text-[13px] text-muted">
          {serviceLabels[app.service] ?? app.service} ・ {fmt(app.created_at)} ・ {app.locale === "en" ? "英語" : "日本語"}
        </p>
        {app.redacted_at && <p className="mt-1 text-[13px] font-semibold text-danger">個人情報は削除済みです（{fmt(app.redacted_at)}）</p>}
      </header>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">連絡先</h3>
        <dl className="grid gap-1 text-[14px]">
          <Row k="氏名" v={app.name} />
          <Row k="メール" v={app.email} />
          <Row k="電話" v={app.phone ?? ""} />
        </dl>
      </section>

      {app.quote && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">料金の目安（サーバー計算）</h3>
          {app.quote.type === "bowing" ? (
            <p className="text-[14px]">
              {String(app.quote.pages)}ページ × {Number(app.quote.unitYen).toLocaleString()}円 = <strong>{Number(app.quote.totalYen).toLocaleString()}円</strong>
              {app.quote.consultDiscount ? "（10ページ超・個別見積もり相談可）" : ""}（税: {String(app.quote.taxMode)}）
            </p>
          ) : (
            <p className="text-[14px]">{fieldValue(app.service, "plan", app.quote.plan)}</p>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">申し込み内容</h3>
        <dl className="grid gap-1 text-[14px]">
          {orderedEntries(app.service, app.payload).map(([k, v]) => (
            <Row key={k} k={fieldLabel(app.service, k)} v={fieldValue(app.service, k, v)} />
          ))}
        </dl>
      </section>

      {files.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">添付ファイル（非公開）</h3>
          <ul className="grid gap-1 text-[13px]">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-button border border-line px-3 py-2">
                <span className="truncate">
                  {f.original_name}
                  <span className="ml-2 text-xs text-muted">
                    {(f.size_bytes / 1024 / 1024).toFixed(1)} MB{f.uploaded ? "" : "・アップロード未完了"}
                  </span>
                </span>
                <button type="button" onClick={() => download(f)} className="shrink-0 text-navy underline">ダウンロード</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">通知</h3>
        <p className="text-[13px]">
          管理人への通知: {notifyLabels[app.notify_admin_status] ?? app.notify_admin_status} ／ 申込者への受付確認: {notifyLabels[app.notify_applicant_status] ?? app.notify_applicant_status}
        </p>
      </section>

      <section className="grid gap-2 rounded-button bg-paper p-3">
        <h3 className="text-[13px] font-semibold">対応状況</h3>
        <div className="flex flex-wrap gap-2">
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)} className="rounded-control border border-muted bg-card p-2 text-[13px]">
            {applicationStatuses.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
          <input
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="メモ（例：見積もり 4,500円を送付）"
            aria-label="状態変更のメモ"
            className="min-w-0 flex-1 rounded-control border border-muted bg-card p-2 text-[13px]"
          />
          <button type="button" onClick={saveStatus} className="rounded-button bg-navy px-3 py-2 text-[13px] text-white">変更</button>
        </div>
        {history.length > 0 && (
          <ol className="mt-1 grid gap-0.5 text-[12px] text-muted">
            {history.map((h) => (
              <li key={h.id}>
                {fmt(h.created_at)}: {h.from_status ? statusLabels[h.from_status as ApplicationStatus] ?? h.from_status : "—"} → {statusLabels[h.to_status as ApplicationStatus] ?? h.to_status}
                {h.note ? `（${h.note}）` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-[13px] font-semibold">管理メモ（申込者には見えません）</h3>
        <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} aria-label="管理メモ" className="rounded-control border border-muted p-2 text-[13px]" />
        <button type="button" onClick={saveNote} className="w-fit rounded-button border border-navy px-3 py-2 text-[13px] text-navy">メモを保存</button>
      </section>

      {msg && <p role="status" className="text-[13px] font-semibold">{msg}</p>}

      {!app.redacted_at && (
        <section className="grid gap-2 border-t border-line pt-4">
          <h3 className="text-[13px] font-semibold text-danger">個人情報の削除</h3>
          <p className="text-[12px] text-muted">氏名・連絡先・入力内容・添付ファイルを削除します。元に戻せません。実行するには受付番号を入力してください。</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={confirmRedact}
              onChange={(e) => setConfirmRedact(e.target.value)}
              placeholder={app.receipt_no}
              aria-label="確認のため受付番号を入力"
              className="rounded-control border border-muted p-2 font-mono text-[13px]"
            />
            <button
              type="button"
              disabled={confirmRedact !== app.receipt_no}
              onClick={redact}
              className="rounded-button border border-danger px-3 py-2 text-[13px] text-danger disabled:opacity-40"
            >
              削除する
            </button>
          </div>
        </section>
      )}
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[160px_1fr] sm:gap-3">
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="whitespace-pre-wrap break-words">{v || "—"}</dd>
    </div>
  );
}
