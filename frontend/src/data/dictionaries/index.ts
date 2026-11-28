import type { Locale, SupportedLocale } from "@/lib/i18n";
import { en } from "./en";
import { ja } from "./ja";
import type { Dictionary } from "./types";

// 公開中の言語の辞書（すべての項目がそろっていないとビルドが通らない）
const dictionaries: Record<Locale, Dictionary> = { ja, en };

/** 一部だけ翻訳した辞書（足りない項目は補う言語＝英語で埋める） */
export type PartialDictionary = { [K in keyof Dictionary]?: Dictionary[K] extends (...a: never[]) => unknown ? Dictionary[K] : Dictionary[K] extends object ? Partial<Dictionary[K]> : Dictionary[K] };

// 欧州 4 言語の辞書は Phase 2 で足す（例: de: deDictionary）。未公開の間はページを作らないので画面には出ない
const partialDictionaries: Partial<Record<Exclude<SupportedLocale, Locale>, PartialDictionary>> = {};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

// 1 段目・2 段目を英語の上に重ねる（関数・配列はそのまま置き換える）
function overlay<T extends object>(base: T, top: Partial<T> | undefined): T {
  if (!top) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(top)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v) ? { ...(b as object), ...(v as object) } : v;
  }
  return out as T;
}

/** 未公開の言語も含めた辞書（翻訳の確認用）。足りない項目は英語で補う */
export function getDictionaryFor(code: SupportedLocale): Dictionary {
  if (code === "ja" || code === "en") return dictionaries[code];
  return overlay(en, partialDictionaries[code] as unknown as Partial<Dictionary> | undefined);
}

export type { Dictionary };
