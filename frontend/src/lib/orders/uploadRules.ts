// 楽譜 PDF の添付の規則（純粋関数・import なし。node のテストから直接読み込む）。
// サーバー側（supabase/functions/_shared/files.ts）と同じ上限であることをテストで確認する

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 3;

export type UploadedFile = { path: string; name: string; size: number };
export type UploadError = "not_connected" | "pdf_only" | "too_large" | "rate_limited" | "failed";

/** 送る前の検査（サーバーとバケットでも同じ制限が掛かる） */
export function checkFile(file: { name: string; size: number; type: string }): UploadError | null {
  if (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) return "pdf_only";
  if (file.size > MAX_FILE_BYTES) return "too_large";
  if (file.size < 1) return "failed";
  return null;
}
