"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 画面から使う Supabase の設定。ここに置くのは公開してよい値（URL と公開キー）だけ。
// 未設定なら backendConfigured = false になり、フォームは「未接続」と表示して送信できないようにする。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const backendConfigured = url !== "" && anonKey !== "";
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// 旧形式の anon キー（JWT）は Authorization にも付ける。新形式の公開キー（sb_publishable_...）は apikey だけ
function authHeaders(): Record<string, string> {
  return anonKey.startsWith("eyJ") ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : { apikey: anonKey };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!backendConfigured) return null;
  if (!client) client = createClient(url, anonKey, { auth: { persistSession: true, storageKey: "sonaria-admin-auth" } });
  return client;
}

export const BUCKET = "application-files";

export type SubmitResponse =
  | { ok: true; receiptNo: string; uploads: { path: string; token: string; name: string }[]; applicantEmail?: string; duplicate?: boolean }
  | { ok: false; status: number; error: string; errors?: Record<string, string>; fileError?: string | null };

async function callFunction(body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${url}/functions/v1/submit-application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

export async function submitApplication(body: Record<string, unknown>): Promise<SubmitResponse> {
  if (!backendConfigured) return { ok: false, status: 0, error: "not_configured" };
  try {
    const { status, json } = await callFunction({ action: "submit", ...body });
    if (status === 200 && json && typeof json.receiptNo === "string") {
      return {
        ok: true,
        receiptNo: json.receiptNo,
        uploads: (json.uploads as { path: string; token: string; name: string }[]) ?? [],
        applicantEmail: json.applicantEmail as string | undefined,
        duplicate: json.duplicate === true,
      };
    }
    return {
      ok: false,
      status,
      error: (json?.error as string) ?? "server",
      errors: json?.errors as Record<string, string> | undefined,
      fileError: json?.fileError as string | null | undefined,
    };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

// 添付ファイルを署名付き URL で非公開バケットへ送る。失敗したファイル名を返す
export async function uploadFiles(uploads: { path: string; token: string; name: string }[], files: File[]): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return files.map((f) => f.name);
  const failed: string[] = [];
  for (const [i, up] of uploads.entries()) {
    // 新規送信ではサーバーがファイルの順番どおりに URL を返す。再送信（未完了分だけ）のときは名前で対応させる
    const file = uploads.length === files.length ? files[i] : files.find((f) => f.name === up.name);
    if (!file) {
      failed.push(up.name);
      continue;
    }
    const { error } = await sb.storage.from(BUCKET).uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
    if (error) failed.push(up.name);
  }
  return failed;
}

export async function completeUploads(requestId: string): Promise<number | null> {
  try {
    const { status, json } = await callFunction({ action: "complete", requestId });
    return status === 200 ? Number(json?.missing ?? 0) : null;
  } catch {
    return null;
  }
}

// 公開設定（運指・ボウイング料金の税の扱い）
export async function fetchTaxMode(): Promise<"undecided" | "included" | "excluded"> {
  if (!backendConfigured) return "undecided";
  try {
    const res = await fetch(`${url}/rest/v1/settings?key=eq.bowing_tax_mode&select=value`, {
      headers: authHeaders(),
    });
    const rows = (await res.json()) as { value: string }[];
    const v = rows?.[0]?.value;
    return v === "included" || v === "excluded" ? v : "undecided";
  } catch {
    return "undecided";
  }
}
