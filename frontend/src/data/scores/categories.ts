import type { Localized, Work } from "./types";

// 編成別・曲種別のカテゴリ。ページは収録作品から自動で作る（catalog.ts の categories）。
// - 作品が MIN_CATEGORY_WORKS 件未満のカテゴリは作らない（中身の薄いページを増やさない）
// - 収録作品がほかのカテゴリとまったく同じになる場合は、先に並んでいるほうだけを作る

export const MIN_CATEGORY_WORKS = 2;

export type CategoryDef = {
  id: string; // URL に使う
  name: Localized;
  intro: Localized; // 利用者向けの短い説明（作品個別の情報は書かない）
  match: (w: Work) => boolean;
};

export const categoryDefs: CategoryDef[] = [
  {
    id: "violin-solo",
    name: { ja: "ヴァイオリン独奏", en: "Solo violin" },
    intro: {
      ja: "伴奏のないヴァイオリン1本のための作品です。和音（重音）や複数の声部を1本の楽器で弾き分ける書法が多く、音程と弓の配分が仕上がりを大きく左右します。",
      en: "Works for unaccompanied violin. Much of this repertoire asks one instrument to carry chords and several voices at once, so intonation and bow distribution shape the result.",
    },
    match: (w) => w.scoring === "violin",
  },
  {
    id: "violin-piano",
    name: { ja: "ヴァイオリンとピアノ", en: "Violin and piano" },
    intro: {
      ja: "ヴァイオリンとピアノのための作品です。ソナタのように両者が対等に書かれた曲と、ピアノが伴奏を受け持つ小品があります。ピアノ譜とヴァイオリンのパート譜をそろえてお使いください。",
      en: "Works for violin and piano, from sonatas in which both instruments are equal partners to short pieces with piano accompaniment. Use the piano score together with the violin part.",
    },
    match: (w) => w.scoring === "violin-piano",
  },
  {
    id: "violin-duo",
    name: { ja: "ヴァイオリン二重奏", en: "Violin duo" },
    intro: {
      ja: "ヴァイオリン2本のための作品です。レッスンでの先生と生徒の合奏や、アンサンブルの入門にも向いています。",
      en: "Works for two violins, suited to teacher–student playing in lessons and to a first step into ensemble playing.",
    },
    match: (w) => w.scoring === "violin-duo",
  },
  {
    id: "string-trio",
    name: { ja: "弦楽三重奏", en: "String trio" },
    intro: {
      ja: "弦楽器3本（多くはヴァイオリン・ヴィオラ・チェロ）のための作品です。4人そろわないときにも室内楽を楽しめます。",
      en: "Works for three string instruments, most often violin, viola and cello — chamber music for when four players are not available.",
    },
    match: (w) => w.scoring === "string-trio",
  },
  {
    id: "string-quartet",
    name: { ja: "弦楽四重奏", en: "String quartet" },
    intro: {
      ja: "ヴァイオリン2本・ヴィオラ・チェロのための作品です。スコアと各パート譜がそろっているかを作品ごとに確認できます。",
      en: "Works for two violins, viola and cello. Each work page shows whether the score and every part are available.",
    },
    match: (w) => w.scoring === "string-quartet",
  },
  {
    id: "string-orchestra",
    name: { ja: "弦楽合奏", en: "String orchestra" },
    intro: {
      ja: "弦楽器だけの合奏のための作品です。各パートを複数人で演奏する前提で書かれています。",
      en: "Works for string orchestra, written with several players on each part.",
    },
    match: (w) => w.scoring === "string-orchestra",
  },
  {
    id: "piano-chamber",
    name: { ja: "ピアノを含む室内楽", en: "Chamber music with piano" },
    intro: {
      ja: "ピアノ三重奏・ピアノ四重奏・ピアノ五重奏など、ピアノと弦楽器のための室内楽です。",
      en: "Piano trios, quartets and quintets — chamber music for piano and strings.",
    },
    match: (w) => w.scoring === "piano-trio" || w.scoring === "piano-quartet" || w.scoring === "piano-quintet",
  },
  {
    id: "concerto",
    name: { ja: "協奏曲", en: "Concertos" },
    intro: {
      ja: "独奏楽器と管弦楽のための作品です。多くの作品では、独奏パートとピアノ伴奏（オーケストラ部分をピアノに置き換えた譜面）で練習・演奏できます。",
      en: "Works for solo instrument and orchestra. For many of them a solo part with piano reduction is available for practice and performance.",
    },
    match: (w) => w.genre === "concerto",
  },
  {
    id: "viola",
    name: { ja: "ヴィオラ", en: "Viola" },
    intro: {
      ja: "ヴィオラが主役の作品です。無伴奏の曲とピアノとの曲があります。",
      en: "Works featuring the viola, both unaccompanied and with piano.",
    },
    match: (w) => w.scoring === "viola" || w.scoring === "viola-piano" || (w.genre === "concerto" && w.instruments[0] === "viola"),
  },
  {
    id: "cello",
    name: { ja: "チェロ", en: "Cello" },
    intro: {
      ja: "チェロが主役の作品です。無伴奏の曲・ピアノとの曲・協奏曲があります。",
      en: "Works featuring the cello: unaccompanied pieces, works with piano and concertos.",
    },
    match: (w) => w.scoring === "cello" || w.scoring === "cello-piano" || (w.genre === "concerto" && w.instruments[0] === "cello"),
  },
  {
    id: "etudes",
    name: { ja: "練習曲・教本", en: "Études and methods" },
    intro: {
      ja: "技術の習得を目的とした練習曲や教本です。レッスンで課題として使われることの多い曲集を中心に収録しています。",
      en: "Études and method books written to build technique, many of them standard lesson material.",
    },
    match: (w) => w.genre === "etude",
  },
];
