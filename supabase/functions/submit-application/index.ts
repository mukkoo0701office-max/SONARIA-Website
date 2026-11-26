// 申し込みの受付（公開エンドポイント）
// docs/decisions/0003-external-backend.md
//
// action: "submit"   入力を検証して保存し、受付番号と添付ファイル用の署名付きアップロード URL を返す
// action: "complete" 添付ファイルのアップロード完了を確認する（requestId を知っている送信者だけが呼べる）
//
// 一般利用者はデータベースに直接書き込めない（RLS）。この関数が service role で保存する。

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail, type SendResult } from "../_shared/email.ts";
import {
  lessonPlanPrices,
  quoteBowing,
  sanitize,
  serviceDefs,
  serviceIds,
  validateAll,
  validateFiles,
  type FileMeta,
  type FormData as AppFormData,
  type LessonPlan,
  type ServiceId,
} from "../_shared/schema.ts";

const BUCKET = "application-files";
const MAX_BODY_BYTES = 100_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// 許可するオリジン（カンマ区切り）。未設定なら全て許可（ローカル開発用）
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowedOrigins.length === 0 ? "*" : origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// 送信元 IP のハッシュ（生の IP は保存しない）。Supabase の本番環境では cf-connecting-ip を優先する
async function clientKey(req: Request): Promise<string> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const ip = req.headers.get("cf-connecting-ip") ?? forwarded[forwarded.length - 1] ?? "unknown";
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "sonaria";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token: unknown, req: Request): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // 未設定ならスキップ（ハニーポットと送信回数制限で防ぐ）
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  const ip = req.headers.get("cf-connecting-ip");
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = await res.json().catch(() => ({ success: false }));
  return out.success === true;
}

// ファイル名を保存用に安全な形にする（日本語名は元の名前として別に保存する）
function storageName(index: number, name: string): string {
  const ext = (name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `${String(index + 1).padStart(2, "0")}.${ext || "bin"}`;
}

async function taxMode(): Promise<string> {
  const { data } = await admin.from("settings").select("value").eq("key", "bowing_tax_mode").maybeSingle();
  return typeof data?.value === "string" ? data.value : "undecided";
}

async function buildQuote(service: ServiceId, data: AppFormData): Promise<Record<string, unknown> | null> {
  if (service === "bowing") {
    const q = quoteBowing(data.service as string, data.pages);
    return q ? { type: "bowing", ...q, taxMode: await taxMode() } : null;
  }
  if (service === "lesson") {
    const plan = data.plan as LessonPlan;
    const p = lessonPlanPrices[plan];
    return p ? { type: "lesson", plan, ...p } : null;
  }
  return null;
}

const serviceLabel: Record<ServiceId, { ja: string; en: string }> = {
  lesson: { ja: "レッスン申し込み", en: "Lesson application" },
  bowing: { ja: "運指・ボウイング依頼", en: "Bowing & fingering request" },
};

// 管理人への通知。連絡先や自由記述は本文に入れない（管理画面で確認する）
async function notifyAdmin(receiptNo: string, service: ServiceId, quote: Record<string, unknown> | null, fileCount: number): Promise<SendResult> {
  const to = Deno.env.get("ADMIN_NOTIFY_EMAIL");
  if (!to) return "not_configured";
  const dashboard = Deno.env.get("ADMIN_DASHBOARD_URL") ?? "";
  const lines = [
    `新しい申し込みを受け付けました。`,
    ``,
    `受付番号: ${receiptNo}`,
    `種類: ${serviceLabel[service].ja}`,
  ];
  if (quote?.type === "bowing") lines.push(`料金の目安: ${quote.pages}ページ × ${quote.unitYen}円 = ${quote.totalYen}円${quote.consultDiscount ? "（10ページ超・個別見積もり相談可）" : ""}`);
  if (quote?.type === "lesson") lines.push(`プラン: ${quote.plan}`);
  if (fileCount) lines.push(`添付ファイル: ${fileCount}件`);
  lines.push(``, `内容は管理画面で確認してください。`);
  if (dashboard) lines.push(dashboard);
  return sendEmail({ to, subject: `[SONARIA] 新しい申し込み ${receiptNo}`, text: lines.join("\n") });
}

// 申込者への受付確認。送信元ドメインの認証が済むまでは無効（APPLICANT_EMAIL_ENABLED=true で有効）
async function notifyApplicant(to: string, locale: "ja" | "en", receiptNo: string, service: ServiceId): Promise<SendResult | "disabled"> {
  if (Deno.env.get("APPLICANT_EMAIL_ENABLED") !== "true") return "disabled";
  const text =
    locale === "ja"
      ? [
          `SONARIA へのお申し込みを受け付けました。`,
          ``,
          `受付番号: ${receiptNo}`,
          `種類: ${serviceLabel[service].ja}`,
          ``,
          `これは受付の確認です。予約・契約・お支払いはまだ確定していません。`,
          `内容を確認のうえ、担当者からご連絡します。`,
        ].join("\n")
      : [
          `We have received your application to SONARIA.`,
          ``,
          `Receipt number: ${receiptNo}`,
          `Type: ${serviceLabel[service].en}`,
          ``,
          `This is only a confirmation of receipt. No booking, contract or payment has been confirmed yet.`,
          `We will contact you after reviewing your request.`,
        ].join("\n");
  return sendEmail({ to, subject: locale === "ja" ? `[SONARIA] 受付番号 ${receiptNo}` : `[SONARIA] Receipt ${receiptNo}`, text });
}

async function handleSubmit(body: Record<string, unknown>, req: Request, origin: string | null): Promise<Response> {
  const service = body.service as ServiceId;
  if (!serviceIds.includes(service)) return json(400, { error: "invalid_service" }, origin);
  const requestId = body.requestId;
  if (typeof requestId !== "string" || !UUID_RE.test(requestId)) return json(400, { error: "invalid_request" }, origin);
  const locale = body.locale === "en" ? "en" : "ja";

  // ハニーポット（人には見えない入力欄）に何か入っていたらボット
  if (typeof body.website === "string" && body.website.trim() !== "") return json(400, { error: "rejected" }, origin);

  // 同じ requestId の再送は、保存済みの受付番号を返す（二重送信防止）
  const { data: existing } = await admin
    .from("applications")
    .select("id, receipt_no")
    .eq("client_request_id", requestId)
    .maybeSingle();
  if (existing) {
    const uploads = await pendingUploads(existing.id);
    return json(200, { receiptNo: existing.receipt_no, uploads, duplicate: true }, origin);
  }

  if (!(await verifyTurnstile(body.turnstileToken, req))) return json(400, { error: "captcha" }, origin);

  const limit = Number(Deno.env.get("RATE_LIMIT_PER_HOUR") ?? "10");
  const { data: allowed, error: rlError } = await admin.rpc("hit_rate_limit", {
    p_key: await clientKey(req),
    p_limit: limit,
    p_window_seconds: 3600,
  });
  if (rlError) {
    console.error(rlError);
    return json(500, { error: "server" }, origin);
  }
  if (!allowed) return json(429, { error: "rate_limited" }, origin);

  const def = serviceDefs[service];
  const data = sanitize(def, (body.data ?? {}) as AppFormData);
  const errors = validateAll(def, data);
  // 型が不正な値（文字列のサイズなど）で検証をすり抜けないよう、ここで型をそろえる
  const files: FileMeta[] = Array.isArray(body.files)
    ? (body.files as unknown[]).slice(0, 50).map((f) => {
        const o = (f ?? {}) as Record<string, unknown>;
        return { name: String(o.name ?? ""), size: Number(o.size), type: String(o.type ?? "") };
      })
    : [];
  const fileError = validateFiles(def.files, files);
  if (Object.keys(errors).length || fileError) return json(400, { error: "validation", errors, fileError }, origin);

  const quote = await buildQuote(service, data);
  const { name, email, phone, consent: _consent, ...rest } = data;

  const { data: inserted, error } = await admin
    .from("applications")
    .insert({
      client_request_id: requestId,
      service,
      locale,
      name,
      email,
      phone: phone || null,
      payload: rest,
      quote,
      consent_at: new Date().toISOString(),
    })
    .select("id, receipt_no")
    .single();

  if (error) {
    // 同時に 2 回届いた場合（一意制約違反）は、先に保存された方を返す
    if (error.code === "23505") {
      const { data: again } = await admin.from("applications").select("id, receipt_no").eq("client_request_id", requestId).single();
      if (again) return json(200, { receiptNo: again.receipt_no, uploads: await pendingUploads(again.id), duplicate: true }, origin);
    }
    console.error(error);
    return json(500, { error: "server" }, origin);
  }

  // 添付ファイル: 行を作り、署名付きアップロード URL を発行する（非公開バケット）
  const uploads: { path: string; token: string; name: string }[] = [];
  for (const [i, f] of files.entries()) {
    const path = `${inserted.id}/${storageName(i, f.name)}`;
    const { error: fileRowError } = await admin.from("application_files").insert({
      application_id: inserted.id,
      storage_path: path,
      original_name: f.name.slice(0, 200),
      mime: f.type,
      size_bytes: f.size,
    });
    if (fileRowError) {
      console.error(fileRowError);
      return json(500, { error: "server", receiptNo: inserted.receipt_no }, origin);
    }
    const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signError || !signed) {
      console.error(signError);
      return json(500, { error: "server", receiptNo: inserted.receipt_no }, origin);
    }
    uploads.push({ path, token: signed.token, name: f.name });
  }

  const adminStatus = await notifyAdmin(inserted.receipt_no, service, quote, files.length);
  const applicantStatus = await notifyApplicant(String(email), locale, inserted.receipt_no, service);
  await admin
    .from("applications")
    .update({ notify_admin_status: adminStatus, notify_applicant_status: applicantStatus })
    .eq("id", inserted.id);

  return json(200, { receiptNo: inserted.receipt_no, uploads, applicantEmail: applicantStatus, quote }, origin);
}

// まだアップロードが終わっていないファイルの署名付き URL を発行し直す（再送信用）
async function pendingUploads(applicationId: string) {
  const { data: rows } = await admin
    .from("application_files")
    .select("storage_path, original_name")
    .eq("application_id", applicationId)
    .eq("uploaded", false);
  const out: { path: string; token: string; name: string }[] = [];
  for (const row of rows ?? []) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUploadUrl(row.storage_path, { upsert: true });
    if (signed) out.push({ path: row.storage_path, token: signed.token, name: row.original_name });
  }
  return out;
}

async function handleComplete(body: Record<string, unknown>, origin: string | null): Promise<Response> {
  const requestId = body.requestId;
  if (typeof requestId !== "string" || !UUID_RE.test(requestId)) return json(400, { error: "invalid_request" }, origin);
  const { data: app } = await admin.from("applications").select("id, receipt_no").eq("client_request_id", requestId).maybeSingle();
  if (!app) return json(404, { error: "not_found" }, origin);

  const { data: listed, error } = await admin.storage.from(BUCKET).list(app.id, { limit: 100 });
  if (error) return json(500, { error: "server" }, origin);
  const present = new Set((listed ?? []).map((o) => `${app.id}/${o.name}`));
  const { data: rows } = await admin.from("application_files").select("id, storage_path").eq("application_id", app.id);
  let missing = 0;
  for (const row of rows ?? []) {
    if (present.has(row.storage_path)) {
      await admin.from("application_files").update({ uploaded: true }).eq("id", row.id);
    } else {
      missing += 1;
    }
  }
  return json(200, { receiptNo: app.receipt_no, missing }, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "method" }, origin);
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return json(413, { error: "too_large" }, origin);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: "too_large" }, origin);
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }

  try {
    if (body.action === "complete") return await handleComplete(body, origin);
    return await handleSubmit(body, req, origin);
  } catch (e) {
    console.error(e);
    return json(500, { error: "server" }, origin);
  }
});
