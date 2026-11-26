// 検索用の文字列の正規化（全角半角・大文字小文字・ひらがなカタカナ・ヴァ行の表記ゆれ）
// 仕様: docs/SONARIA_TEACHER_DIRECTORY_UI_SPEC_v1.0.md §4
export function normalizeForSearch(text: string): string {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      // ひらがな → カタカナ
      .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
      // ヴァ行 → バ行（ヴァイオリン / バイオリン）
      .replace(/ヴァ/g, "バ")
      .replace(/ヴィ/g, "ビ")
      .replace(/ヴェ/g, "ベ")
      .replace(/ヴォ/g, "ボ")
      .replace(/ヴ/g, "ブ")
      .replace(/[\s・･\-‐ー]/g, "")
  );
}
