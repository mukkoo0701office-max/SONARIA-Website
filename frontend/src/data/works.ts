// 楽譜検索で使う作品データの型と、デモデータ。
//
// 仮: 以下はプロトタイプ（prototypes/score-search-ui-v1.html）と同じ 12 件の**デモデータ**。
// 実際のカタログではない。PDF 数・演奏人数は説明用の値で、特に「5人以上」は大まかな区分であり
// 管弦楽・協奏曲の正確な人数ではない（docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md）。
// TODO: 試験移行（20〜30件）のデータに置き換える。その際は Work と Edition / ScoreAsset を分け、
//       演奏人数は版・編曲ごとに持たせる。

export type Ensemble = "strings" | "piano" | "orchestra" | "mixed";
export type MusicalForm = "chamber" | "sonata" | "concerto" | "symphony" | "suite";
export type Era = "baroque" | "classical" | "romantic" | "modern";

export type Localized = { ja: string; en: string };

export type WorkSummary = {
  id: number;
  title: Localized;
  composer: Localized;
  players: number;
  ensemble: Ensemble;
  form: MusicalForm | null; // ソナタ・協奏曲などに当てはまらない小品・練習曲は null（「すべて」のときだけ表示）
  era: Era;
  pdfCount: number;
  // カタログの作品 ID（公開済みの実データのとき。デモデータには無い）
  slug?: string;
  hasEnglish?: boolean; // 英語の作品ページがあるか
  searchText?: string; // 別名・原語名・作品番号など、検索で一致させる追加の文字列
};

export const ensembles: readonly Ensemble[] = ["strings", "piano", "orchestra", "mixed"];
export const musicalForms: readonly MusicalForm[] = ["chamber", "sonata", "concerto", "symphony", "suite"];
export const eras: readonly Era[] = ["baroque", "classical", "romantic", "modern"];

export const isDemoData = true;

export const works: readonly WorkSummary[] = [
  { id: 1, title: { ja: "弦楽四重奏曲 第14番《死と乙女》", en: "String Quartet No. 14 Death and the Maiden" }, composer: { ja: "シューベルト", en: "Franz Schubert" }, players: 4, ensemble: "strings", form: "chamber", era: "romantic", pdfCount: 5 },
  { id: 2, title: { ja: "無伴奏チェロ組曲 第1番", en: "Cello Suite No. 1" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 1, ensemble: "strings", form: "suite", era: "baroque", pdfCount: 1 },
  { id: 3, title: { ja: "ピアノソナタ 第14番《月光》", en: "Piano Sonata No. 14 Moonlight" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 1, ensemble: "piano", form: "sonata", era: "classical", pdfCount: 1 },
  { id: 4, title: { ja: "弦楽五重奏曲 ハ長調 D.956", en: "String Quintet in C major D.956" }, composer: { ja: "シューベルト", en: "Franz Schubert" }, players: 5, ensemble: "strings", form: "chamber", era: "romantic", pdfCount: 6 },
  { id: 5, title: { ja: "ピアノ協奏曲 第2番", en: "Piano Concerto No. 2" }, composer: { ja: "ラフマニノフ", en: "S. Rachmaninoff" }, players: 5, ensemble: "orchestra", form: "concerto", era: "romantic", pdfCount: 2 },
  { id: 6, title: { ja: "交響曲 第5番", en: "Symphony No. 5" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 5, ensemble: "orchestra", form: "symphony", era: "classical", pdfCount: 24 },
  { id: 7, title: { ja: "ヴァイオリンソナタ 第5番《春》", en: "Violin Sonata No. 5 Spring" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 2, ensemble: "mixed", form: "sonata", era: "classical", pdfCount: 2 },
  { id: 8, title: { ja: "ホルベルク組曲", en: "Holberg Suite" }, composer: { ja: "グリーグ", en: "Edvard Grieg" }, players: 5, ensemble: "strings", form: "suite", era: "romantic", pdfCount: 5 },
  { id: 9, title: { ja: "2つのヴァイオリンのための協奏曲", en: "Concerto for Two Violins" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 5, ensemble: "strings", form: "concerto", era: "baroque", pdfCount: 3 },
  { id: 10, title: { ja: "ピアノ三重奏曲 第1番", en: "Piano Trio No. 1" }, composer: { ja: "メンデルスゾーン", en: "F. Mendelssohn" }, players: 3, ensemble: "mixed", form: "chamber", era: "romantic", pdfCount: 3 },
  { id: 11, title: { ja: "弦楽四重奏曲 第19番《不協和音》", en: "String Quartet No. 19 Dissonance" }, composer: { ja: "モーツァルト", en: "W. A. Mozart" }, players: 4, ensemble: "strings", form: "chamber", era: "classical", pdfCount: 5 },
  { id: 12, title: { ja: "フルートソナタ ロ短調 BWV1030", en: "Flute Sonata in B minor BWV1030" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 2, ensemble: "mixed", form: "sonata", era: "baroque", pdfCount: 2 },
];
