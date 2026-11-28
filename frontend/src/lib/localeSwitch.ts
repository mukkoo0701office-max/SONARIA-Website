// 言語の切り替え先を決める（クライアントでも使う軽いモジュール。カタログを読み込まない）
import type { Locale } from "@/lib/i18n";

/** 一部の言語にしかないページ（パス → あるページの言語）。全言語にあるページは含まない */
export type PartialLocalePaths = Record<string, readonly Locale[]>;

/** その言語にページが無ければ、1 つ上の階層（一覧など）へ。最後はトップページ */
export function switchTarget(rest: string, target: Locale, partial: PartialLocalePaths): string {
  let path = rest || "/";
  while (path !== "/" && partial[path] && !partial[path].includes(target)) {
    path = path.replace(/[^/]+\/$/, "");
  }
  return path;
}
