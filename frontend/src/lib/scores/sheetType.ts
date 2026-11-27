// 譜面の種類（スコア／パート譜）の判定。PR #24 §3「譜面種類：スコア譜 / パート譜 / 両方あり」。
// 実在するファイル（ScoreAsset の part）だけから判定する。スコアだけの作品を「パート譜あり」と誤表示しない。
// 注: node のテスト（tests/*.test.mjs）から直接読み込むため、別名（@/）の import を書かない

export type SheetType = "score" | "parts" | "both";
export type SheetFilter = "all" | "score" | "parts" | "both";
export const sheetFilters: readonly SheetFilter[] = ["all", "score", "parts", "both"];
/** 絞り込みの選択肢（「すべて」以外） */
export const sheetKinds = ["score", "parts", "both"] as const;

/** ファイルの part の一覧から譜面の種類を決める。ファイルが無ければ null */
export function sheetTypeOf(parts: readonly string[]): SheetType | null {
  const hasScore = parts.includes("score");
  const hasParts = parts.some((p) => p !== "score");
  if (hasScore && hasParts) return "both";
  if (hasScore) return "score";
  if (hasParts) return "parts";
  return null;
}

/**
 * 絞り込みに一致するか。
 * - score: スコアがある（スコアだけ・両方あり）
 * - parts: パート譜がある（パート譜だけ・両方あり）
 * - both: スコアとパート譜の両方がある
 */
export function matchesSheet(sheet: SheetType | null | undefined, filter: SheetFilter): boolean {
  if (filter === "all") return true;
  if (!sheet) return false;
  if (filter === "both") return sheet === "both";
  return sheet === filter || sheet === "both";
}

// 演奏人数。5 は「5 人以上」（カタログの players は 5 以上をまとめて 5 としている作品もある）
export type PlayersFilter = "all" | "1" | "2" | "3" | "4" | "5";
export const playersFilters: readonly PlayersFilter[] = ["all", "1", "2", "3", "4", "5"];
/** 絞り込みの選択肢（「すべて」以外） */
export const playerCounts = ["1", "2", "3", "4", "5"] as const;

export function matchesPlayers(players: number, filter: PlayersFilter): boolean {
  if (filter === "all") return true;
  const n = Number(filter);
  return n >= 5 ? players >= 5 : players === n;
}
