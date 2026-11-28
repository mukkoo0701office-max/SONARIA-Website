// 楽譜 PDF のアップロード（運指・運弓の申込）。
// 1. 受付と同じ Supabase の関数（upload-url）に、1 回限りの署名付きアップロード URL を発行してもらう
// 2. その URL へファイルを送る（非公開バケット。利用者は読めない）
// 3. 申込の送信時に保存先のパスを添える（受付関数が実在を確かめる）
// 設計: docs/payments/PAYMENTS_DESIGN.md「7. 楽譜 PDF のアップロード」
import { submitEndpoint } from "./submit";

export { MAX_FILE_BYTES, MAX_FILES, checkFile, type UploadedFile, type UploadError } from "./uploadRules";
import { checkFile, type UploadedFile, type UploadError } from "./uploadRules";

const PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export async function uploadScore(file: File): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: UploadError }> {
  const pre = checkFile(file);
  if (pre) return { ok: false, error: pre };
  const submit = submitEndpoint();
  if (!submit) return { ok: false, error: "not_connected" };
  try {
    const res = await fetch(submit.replace(/\/submit$/, "/upload-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429) return { ok: false, error: "rate_limited" };
    if (res.status === 400) {
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: e.error === "too_large" ? "too_large" : e.error === "pdf_only" ? "pdf_only" : "failed" };
    }
    if (!res.ok) return { ok: false, error: "failed" };
    const { path, uploadUrl } = (await res.json()) as { path?: string; uploadUrl?: string };
    if (!path || !uploadUrl) return { ok: false, error: "failed" };

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "x-upsert": "false", apikey: PUBLISHABLE_KEY }, body: form, signal: AbortSignal.timeout(120000) });
    if (put.status === 413) return { ok: false, error: "too_large" };
    if (!put.ok) return { ok: false, error: "failed" };
    return { ok: true, file: { path, name: file.name.slice(0, 200), size: file.size } };
  } catch {
    return { ok: false, error: "failed" };
  }
}
