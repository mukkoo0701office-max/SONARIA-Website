// 楽譜 PDF のアップロード用の署名付き URL を発行する（公開エンドポイント）
// - サイトの Origin だけを受け付ける（ALLOWED_ORIGINS。submit と同じ）
// - PDF・20 MB まで（宣言の検査。実際の制限は非公開バケットの設定でも掛かる）
// - 送信元ごとに 1 時間あたりの発行回数を制限する（IP はソルト付きハッシュだけ保存）
// - 発行するのは 1 回限りのアップロード URL だけ。利用者はファイルを読めない（管理人だけが読む）
// 設計: docs/payments/PAYMENTS_DESIGN.md「7. 楽譜 PDF のアップロード」
import postgres from "npm:postgres@3.4.5";
import { isAllowedOrigin } from "../_shared/validate.ts";
import { checkUploadRequest, FILE_BUCKET, newFilePath } from "../_shared/files.ts";

const DEFAULT_ORIGINS = ["https://mukkoo0701office-max.github.io"];
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;
const maxPerHour = Number(Deno.env.get("UPLOAD_LIMIT_PER_HOUR") ?? "20") || 20;

// ランタイムが自動で渡す値（コードや GitHub に鍵を置かない）
const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const dbUrl = Deno.env.get("SUPABASE_DB_URL");
const sql = dbUrl ? postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 20 }) : null;

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin, origins)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (!isAllowedOrigin(origin, origins)) return json(403, { error: "forbidden_origin" }, origin);
  if (!sql || !supabaseUrl || !serviceKey) return json(503, { error: "not_configured" }, origin);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 2000) return json(413, { error: "too_large" }, origin);
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }
  const v = checkUploadRequest(body);
  if (!v.ok) return json(400, { error: v.error }, origin);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  try {
    const rows = await sql`select private.allow_upload(${ip}, ${maxPerHour}::int) as ok`;
    if (!(rows[0] as { ok: boolean } | undefined)?.ok) return json(429, { error: "rate_limited" }, origin);

    const path = newFilePath(new Date(), crypto.randomUUID());
    // Storage API: 署名付きアップロード URL（既定 2 時間有効・1 回限り）
    const res = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${FILE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("sign upload failed", res.status);
      return json(502, { error: "storage_error" }, origin);
    }
    const signed = (await res.json()) as { url?: string };
    if (!signed.url) return json(502, { error: "storage_error" }, origin);
    return json(200, { path, uploadUrl: `${supabaseUrl}/storage/v1${signed.url}` }, origin);
  } catch (e) {
    console.error("upload-url error", e instanceof Error ? e.message : "unknown");
    return json(500, { error: "server_error" }, origin);
  }
});
