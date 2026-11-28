// 申し込み・依頼・講師登録の受付（公開エンドポイント）
// - サイトの Origin だけを受け付ける（ALLOWED_ORIGINS）
// - 入力を検証し、private.accept_submission で保存する（送信回数制限・二重送信防止はデータベース側）
// - データベースへはランタイムが自動で渡す SUPABASE_DB_URL で接続する（API キーをコードや GitHub に置かない）
import postgres from "npm:postgres@3.4.5";
import { isAllowedOrigin, MAX_BODY_BYTES, UUID, validateSubmission } from "../_shared/validate.ts";
import { buildNotifyMail } from "../_shared/notify.ts";
import { attachedFiles, FILE_BUCKET } from "../_shared/files.ts";
import { computeQuote, currencyOf, quoteInputFromPayload, regionFromPayload, type PriceRow, type Region } from "../_shared/pricing.ts";

// 既定の許可 Origin（プレビュー）。本番ドメインが決まったら Secrets の ALLOWED_ORIGINS で追加する
const DEFAULT_ORIGINS = ["https://mukkoo0701office-max.github.io"];
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;
const maxPerHour = Number(Deno.env.get("RATE_LIMIT_PER_HOUR") ?? "10") || 10;

// 管理人への通知（Resend）。両方そろっているときだけ送る
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const notifyTo = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
// 送信元: 独自ドメインを Resend で認証するまでは Resend の共用アドレス（アカウント本人宛てにだけ届く）
const mailFrom = Deno.env.get("MAIL_FROM") || "SONARIA <onboarding@resend.dev>";
const dashboardUrl = Deno.env.get("ADMIN_DASHBOARD_URL") ||
  "https://supabase.com/dashboard/project/oqhehjaeqjsuyblokonz/editor";

async function notifyAdmin(kind: Parameters<typeof buildNotifyMail>[0], receipt: string): Promise<void> {
  if (!resendKey || !notifyTo) return;
  const mail = buildNotifyMail(kind, receipt, new Date(), dashboardUrl);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: [notifyTo], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("notify failed", res.status);
  } catch (e) {
    // 通知に失敗しても受付は成立している（保存済み）。お客さんにはエラーを返さない
    console.error("notify error", e instanceof Error ? e.message : "unknown");
  }
}

const dbUrl = Deno.env.get("SUPABASE_DB_URL");
const sql = dbUrl ? postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 20 }) : null;

// アクセス元の国（前段のプロキシが付ける場合だけ。付かなければ null）。VPN などで誤るので参考値として保存するだけ
// 要検証: Supabase の Edge Functions に国のヘッダーが付くかは公式に保証されていない（docs/payments/PAYMENTS_DESIGN.md）
function detectCountry(req: Request): string | null {
  for (const h of ["cf-ipcountry", "x-country-code", "x-vercel-ip-country", "x-geo-country"]) {
    const v = (req.headers.get(h) ?? "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") return v;
  }
  return null;
}

/** 日本時間の今日（料金マスタの有効開始日と比べる） */
function todayTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

// 受付時の金額をサーバーで計算して保存する（画面の概算は参考値。確定は管理人が行う）。
// 失敗しても受付は成立している（保存済み）ので、エラーは記録だけにする
async function saveServerQuote(receipt: string, payload: unknown, detected: string | null): Promise<void> {
  if (!sql) return;
  try {
    // 注: postgres.js は「::jsonb」だけだと文字列を JSON の文字列値として保存するため、text を経由して変換する
    const input = quoteInputFromPayload(payload);
    // 地域は自動判定（2026-11-29 運営者決定: 利用者が選ぶ欄は置かない）。
    // サーバーで判定できたアクセス元の国を優先し、無ければ端末のタイムゾーンからの推定、どちらも無ければ未確定（通貨を決めない）。
    // どちらも誤りうる（VPN・旅行）ので、最終的な金額と通貨は支払い前に管理人が確定する
    const region: Region | null = detected ? (detected === "JP" ? "jp" : "intl") : regionFromPayload(payload);
    const p = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
    // 銀行振込は日本のみ（日本以外はカードに寄せる）
    const method = p.paymentMethod === "bank_transfer" && region === "jp" ? "bank_transfer" : p.paymentMethod === "card" || p.paymentMethod === "bank_transfer" ? "card" : null;
    let quote: unknown = null;
    if (input && region) {
      const rows = (await sql`select service, item, mode, jpy, usd_cents, to_char(effective_from, 'YYYY-MM-DD') as effective_from, active from public.price_items where service = ${input.service}`) as unknown as PriceRow[];
      quote = { ...computeQuote(input, rows, region, todayTokyo()), computedAt: new Date().toISOString() };
    }
    await sql`
      update public.submissions set
        region = ${region}, region_detected = ${detected}, currency = ${region ? currencyOf(region) : null},
        payment_method = ${method}, server_quote = ${quote === null ? null : JSON.stringify(quote)}::text::jsonb
      where receipt_no = ${receipt} and server_quote is null and region is null`;
  } catch (e) {
    console.error("server quote failed", e instanceof Error ? e.message : "unknown");
  }
}

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, idempotency-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin, origins)) h["Access-Control-Allow-Origin"] = origin as string;
  return h;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (!isAllowedOrigin(origin, origins)) return json(403, { error: "origin_not_allowed" }, origin);
  if (!sql) return json(503, { error: "not_configured" }, origin);

  const key = req.headers.get("idempotency-key") ?? "";
  if (!UUID.test(key)) return json(400, { error: "invalid", errors: ["idempotency-key: uuid required"] }, origin);

  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(413, { error: "too_large" }, origin);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid", errors: ["body: json required"] }, origin);
  }

  const v = validateSubmission(body);
  if (!v.ok) return json(400, { error: "invalid", errors: v.errors }, origin);

  // 送信元 IP（Supabase のゲートウェイが付ける）。保存するのはソルト付きハッシュだけ
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  // 添付の楽譜 PDF（運指・運弓）: 形を検査し、実際にアップロード済みであることをデータベースで確かめる
  const attached = attachedFiles(v.payload);
  if (!attached.ok) return json(400, { error: "invalid", errors: [attached.error] }, origin);

  try {
    if (attached.files.length) {
      const paths = attached.files.map((f) => f.path);
      const found = await sql`select name from storage.objects where bucket_id = ${FILE_BUCKET} and name = any(${sql.array(paths)})`;
      if (found.length !== paths.length) return json(400, { error: "invalid", errors: ["files: not uploaded"] }, origin);
      // 検査した形に置き換えて保存する（名前・大きさの長さをそろえる）
      (v.payload.bowing as Record<string, unknown>).files = attached.files;
    }
    // 注: postgres.js は「文字列::jsonb」を JSON の文字列値として保存してしまうため、text を経由して変換する（server_quote と同じ）
    const rows = await sql`
      select result, receipt_no from private.accept_submission(
        ${ip}, ${key}::uuid, ${v.kind}, ${v.locale}, ${v.name}, ${v.email},
        ${JSON.stringify(v.payload)}::text::jsonb, ${v.estimate}::int, ${maxPerHour}::int
      )`;
    const r = rows[0] as { result: string; receipt_no: string | null } | undefined;
    if (!r) return json(500, { error: "server_error" }, origin);
    if (r.result === "rate_limited") return json(429, { error: "rate_limited" }, origin);
    // 新規の受付だけ通知する（同じ送信の再送＝duplicate では送らない）
    if (r.result === "accepted" && r.receipt_no) {
      await saveServerQuote(r.receipt_no, v.payload, detectCountry(req));
      await notifyAdmin(v.kind, r.receipt_no);
    }
    return json(200, { status: r.result, receipt: r.receipt_no }, origin);
  } catch (e) {
    // 入力内容（個人情報）はログに出さない
    console.error("accept_submission failed", e instanceof Error ? e.message : "unknown");
    return json(500, { error: "server_error" }, origin);
  }
});
