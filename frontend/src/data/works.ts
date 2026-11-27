// 楽譜検索で使う作品データの型と、デモデータ。
//
// 仮: 以下はプロトタイプ（prototypes/score-search-ui-v1.html）と同じ 12 件の**デモデータ**。
// 実際のカタログではない。PDF 数・演奏人数は説明用の値で、特に「5人以上」は大まかな区分であり
// 管弦楽・協奏曲の正確な人数ではない（docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md）。
// TODO: 試験移行（20〜30件）のデータに置き換える。その際は Work と Edition / ScoreAsset を分け、
//       演奏人数は版・編曲ごとに持たせる。

// 検索の絞り込みの軸（2026-11-27 改訂）。
// 旧: 演奏人数・楽器編成（弦楽／ピアノ／管弦楽／混合）・楽曲形式。ヴァイオリンソナタが「混合編成」になる、
//     小品・練習曲・変奏曲が楽曲形式で選べない、人数と編成が重複する、といった問題があったため、
//     「自分の楽器」「編成（具体的な組み合わせ）」「種類（ジャンル）」「作曲家」「時代」に分けた。

/** 編成。カタログの scoring を、利用者が探す単位にまとめたもの（並びは小さい編成から） */
export type Formation =
  | "solo-string" // 無伴奏（ヴァイオリン・ヴィオラ・チェロ）
  | "piano"
  | "violin-piano"
  | "viola-piano"
  | "cello-piano"
  | "string-duo" // 弦楽二重奏（ヴァイオリン二重奏を含む）
  | "string-trio"
  | "piano-trio"
  | "string-quartet"
  | "piano-quartet"
  | "quintet" // 五重奏（弦楽・ピアノ）
  | "string-orchestra"
  | "solo-orchestra" // 独奏と管弦楽（協奏曲など）
  | "other";
export const formations: readonly Formation[] = ["solo-string", "piano", "violin-piano", "viola-piano", "cello-piano", "string-duo", "string-trio", "piano-trio", "string-quartet", "piano-quartet", "quintet", "string-orchestra", "solo-orchestra", "other"];

/** 楽器。「自分の楽器のパートがある作品」を探すために使う */
export type Instrument = "violin" | "viola" | "cello" | "bass" | "piano";
export const instruments: readonly Instrument[] = ["violin", "viola", "cello", "bass", "piano"];

/** 種類（ジャンル） */
export type Genre = "sonata" | "concerto" | "chamber" | "suite" | "variations" | "etude" | "piece" | "symphony" | "other";
export const genres: readonly Genre[] = ["sonata", "concerto", "chamber", "suite", "variations", "etude", "piece", "symphony", "other"];

export type Era = "baroque" | "classical" | "romantic" | "modern";
export const eras: readonly Era[] = ["baroque", "classical", "romantic", "modern"];

export type Localized = { ja: string; en: string };

export type WorkSummary = {
  id: number;
  title: Localized;
  composer: Localized;
  composerId: string;
  players: number;
  formation: Formation;
  instruments: readonly Instrument[];
  genre: Genre;
  era: Era;
  pdfCount: number;
  // カタログの作品 ID（公開済みの実データのとき。デモデータには無い）
  slug?: string;
  hasEnglish?: boolean; // 英語の作品ページがあるか
  searchText?: string; // 別名・原語名・作品番号など、検索で一致させる追加の文字列
};

export const isDemoData = true;

export const works: readonly WorkSummary[] = [
  { id: 1, title: { ja: "弦楽四重奏曲 第14番《死と乙女》", en: "String Quartet No. 14 Death and the Maiden" }, composer: { ja: "シューベルト", en: "Franz Schubert" }, players: 4, composerId: "schubert", formation: "string-quartet", instruments: ["violin", "viola", "cello"], genre: "chamber", era: "romantic", pdfCount: 5 },
  { id: 2, title: { ja: "無伴奏チェロ組曲 第1番", en: "Cello Suite No. 1" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 1, composerId: "bach", formation: "solo-string", instruments: ["cello"], genre: "suite", era: "baroque", pdfCount: 1 },
  { id: 3, title: { ja: "ピアノソナタ 第14番《月光》", en: "Piano Sonata No. 14 Moonlight" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 1, composerId: "beethoven", formation: "piano", instruments: ["piano"], genre: "sonata", era: "classical", pdfCount: 1 },
  { id: 4, title: { ja: "弦楽五重奏曲 ハ長調 D.956", en: "String Quintet in C major D.956" }, composer: { ja: "シューベルト", en: "Franz Schubert" }, players: 5, composerId: "schubert", formation: "quintet", instruments: ["violin", "viola", "cello"], genre: "chamber", era: "romantic", pdfCount: 6 },
  { id: 5, title: { ja: "ピアノ協奏曲 第2番", en: "Piano Concerto No. 2" }, composer: { ja: "ラフマニノフ", en: "S. Rachmaninoff" }, players: 5, composerId: "rachmaninoff", formation: "solo-orchestra", instruments: ["piano"], genre: "concerto", era: "romantic", pdfCount: 2 },
  { id: 6, title: { ja: "交響曲 第5番", en: "Symphony No. 5" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 5, composerId: "beethoven", formation: "other", instruments: ["violin", "viola", "cello", "bass"], genre: "symphony", era: "classical", pdfCount: 24 },
  { id: 7, title: { ja: "ヴァイオリンソナタ 第5番《春》", en: "Violin Sonata No. 5 Spring" }, composer: { ja: "ベートーヴェン", en: "L. van Beethoven" }, players: 2, composerId: "beethoven", formation: "violin-piano", instruments: ["violin", "piano"], genre: "sonata", era: "classical", pdfCount: 2 },
  { id: 8, title: { ja: "ホルベルク組曲", en: "Holberg Suite" }, composer: { ja: "グリーグ", en: "Edvard Grieg" }, players: 5, composerId: "grieg", formation: "string-orchestra", instruments: ["violin", "viola", "cello", "bass"], genre: "suite", era: "romantic", pdfCount: 5 },
  { id: 9, title: { ja: "2つのヴァイオリンのための協奏曲", en: "Concerto for Two Violins" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 5, composerId: "bach", formation: "solo-orchestra", instruments: ["violin", "viola", "cello", "bass"], genre: "concerto", era: "baroque", pdfCount: 3 },
  { id: 10, title: { ja: "ピアノ三重奏曲 第1番", en: "Piano Trio No. 1" }, composer: { ja: "メンデルスゾーン", en: "F. Mendelssohn" }, players: 3, composerId: "mendelssohn", formation: "piano-trio", instruments: ["violin", "cello", "piano"], genre: "chamber", era: "romantic", pdfCount: 3 },
  { id: 11, title: { ja: "弦楽四重奏曲 第19番《不協和音》", en: "String Quartet No. 19 Dissonance" }, composer: { ja: "モーツァルト", en: "W. A. Mozart" }, players: 4, composerId: "mozart", formation: "string-quartet", instruments: ["violin", "viola", "cello"], genre: "chamber", era: "classical", pdfCount: 5 },
  { id: 12, title: { ja: "フルートソナタ ロ短調 BWV1030", en: "Flute Sonata in B minor BWV1030" }, composer: { ja: "バッハ", en: "J. S. Bach" }, players: 2, composerId: "bach", formation: "other", instruments: ["piano"], genre: "sonata", era: "baroque", pdfCount: 2 },
];
