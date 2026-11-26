import type { Composer, Work } from "./types";

// 仮: 表示確認用のサンプル（プレビュー環境だけで、公開できる作品がまだ無いときに使う）。
// 本番ビルドには含まれない（catalog.ts の条件付き require）。
// 作品の事実（調性・楽章・献呈など）は一般的な資料で確認できる内容だけを書いている。
// PDF は SONARIA が作成した表示確認用のダミー（楽譜ではない）。

export const demoData: { composers: Composer[]; works: Work[] } = {
  composers: [
    {
      id: "beethoven",
      name: { ja: "ルートヴィヒ・ヴァン・ベートーヴェン", en: "Ludwig van Beethoven", original: "Ludwig van Beethoven" },
      short: { ja: "ベートーヴェン", en: "Beethoven" },
      aliases: ["ベートーベン", "Beethoven"],
      born: "1770",
      died: "1827-03-26",
      nationality: { ja: "ドイツ（ボン生まれ、ウィーンで活動）", en: "German (born in Bonn, active in Vienna)" },
      era: "classical",
      portrait: null,
      profile: {
        ja: {
          position: "古典派の形式を受け継ぎながら、ロマン派への道を開いた作曲家です。（表示確認用サンプル）",
        },
      },
      sources: [{ label: "表示確認用サンプル" }],
    },
  ],
  works: [
    {
      id: "sample-beethoven-violin-sonata-5",
      composerId: "beethoven",
      title: { ja: "ヴァイオリン・ソナタ第5番 ヘ長調《春》", en: "Violin Sonata No. 5 in F major “Spring”", original: "Sonate für Klavier und Violine Nr. 5 F-Dur" },
      aliases: ["春", "スプリング・ソナタ", "Spring Sonata"],
      catalog: [{ type: "op", value: "24" }],
      key: { ja: "ヘ長調", en: "F major" },
      composed: "1800–1801",
      scoring: "violin-piano",
      players: 2,
      instruments: ["violin", "piano"],
      genre: "sonata",
      era: "classical",
      movements: [
        { ja: "第1楽章 Allegro", en: "I. Allegro" },
        { ja: "第2楽章 Adagio molto espressivo", en: "II. Adagio molto espressivo" },
        { ja: "第3楽章 Scherzo: Allegro molto", en: "III. Scherzo: Allegro molto" },
        { ja: "第4楽章 Rondo: Allegro ma non troppo", en: "IV. Rondo: Allegro ma non troppo" },
      ],
      duration: null,
      difficulty: null,
      text: {
        ja: {
          overview:
            "【表示確認用サンプル】ベートーヴェンが1800年から1801年にかけて作曲した、ピアノとヴァイオリンのためのソナタです。ベートーヴェンのヴァイオリン・ソナタで初めて4楽章で書かれました。《春》という呼び名は作曲者自身が付けたものではなく、後の時代に広まった愛称です。",
        },
      },
      sources: [{ label: "表示確認用サンプル" }],
      featured: true,
      publishedAt: "2026-11-26",
      updatedAt: "2026-11-26",
      editions: [
        {
          id: "sample",
          label: { ja: "表示確認用ダミー（楽譜ではありません）", en: "Display test dummy (not a score)" },
          source: { type: "own", note: "SONARIA 作成のダミー PDF" },
          rights: { status: "approved", basis: "SONARIA が作成した表示確認用ファイル" },
          assets: [
            { id: "score", part: "piano", file: "/samples/sample.pdf", filename: "sample.pdf", preview: null, sha256: "", pages: 1, bytes: 2048 },
            { id: "violin", part: "violin", file: "/samples/sample.pdf", filename: "sample.pdf", preview: null, sha256: "", pages: 1, bytes: 2048 },
          ],
        },
      ],
    },
  ],
};
