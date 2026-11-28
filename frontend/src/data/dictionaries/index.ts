import type { Locale, SupportedLocale } from "@/lib/i18n";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { ja } from "./ja";
import type { Dictionary } from "./types";

// 全言語の辞書（すべての項目がそろっていないとビルドが通らない）。
// 欧州 4 言語は運営者の決定（2026-11-28）により Claude の訳をそのまま公開している
const dictionaries: Record<SupportedLocale, Dictionary> = { ja, en, de, fr, es, it };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** 未公開の言語も含めた辞書（翻訳の確認用） */
export function getDictionaryFor(code: SupportedLocale): Dictionary {
  return dictionaries[code];
}

export type { Dictionary };
