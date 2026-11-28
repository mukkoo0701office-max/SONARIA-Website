// 申込に添付する楽譜 PDF の規則（純粋関数・import なし）。upload-url と submit の両方が使う
// 設計: docs/payments/PAYMENTS_DESIGN.md「7. 楽譜 PDF のアップロード」

export const FILE_BUCKET = "submission-files";
/** 1 ファイルの上限（バケットの file_size_limit と同じ） */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** 1 件の申込に付けられるファイル数 */
export const MAX_FILES = 3;
/** 保存先のパス: pending/日付/ランダム ID.pdf（利用者のファイル名はパスに使わない） */
export const FILE_PATH = /^pending\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export type UploadRequest = { name: string; size: number; type: string };
export type AttachedFile = { path: string; name: string; size: number };

/** アップロード URL の発行前の検査（宣言された種類・大きさ。実際の制限はバケット側でも掛かる） */
export function checkUploadRequest(v: unknown): { ok: true; file: UploadRequest } | { ok: false; error: string } {
  if (typeof v !== "object" || v === null) return { ok: false, error: "invalid" };
  const o = v as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const size = typeof o.size === "number" ? o.size : NaN;
  const type = typeof o.type === "string" ? o.type : "";
  if (!name || name.length > 200) return { ok: false, error: "invalid_name" };
  if (type !== "application/pdf" || !/\.pdf$/i.test(name)) return { ok: false, error: "pdf_only" };
  if (!Number.isInteger(size) || size < 1) return { ok: false, error: "invalid_size" };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "too_large" };
  return { ok: true, file: { name, size, type } };
}

/** 保存先のパスを作る（日本時間の日付＋ランダム ID） */
export function newFilePath(now: Date, id: string): string {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  return `pending/${day}/${id.toLowerCase()}.pdf`;
}

/** 申込の内容から添付ファイルの一覧を取り出して形を検査する（存在の確認は呼び出し側がデータベースで行う） */
export function attachedFiles(payload: unknown): { ok: true; files: AttachedFile[] } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) return { ok: true, files: [] };
  const b = (payload as Record<string, unknown>).bowing;
  if (typeof b !== "object" || b === null) return { ok: true, files: [] };
  const list = (b as Record<string, unknown>).files;
  if (list === undefined) return { ok: true, files: [] };
  if (!Array.isArray(list) || list.length > MAX_FILES) return { ok: false, error: "files: invalid" };
  const files: AttachedFile[] = [];
  const seen = new Set<string>();
  for (const f of list) {
    if (typeof f !== "object" || f === null) return { ok: false, error: "files: invalid" };
    const o = f as Record<string, unknown>;
    if (typeof o.path !== "string" || !FILE_PATH.test(o.path) || seen.has(o.path)) return { ok: false, error: "files: invalid path" };
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 200) : "";
    const size = typeof o.size === "number" && Number.isInteger(o.size) && o.size > 0 && o.size <= MAX_FILE_BYTES ? o.size : 0;
    seen.add(o.path);
    files.push({ path: o.path, name: name || "score.pdf", size });
  }
  return { ok: true, files };
}
