// 講師ディレクトリのデータ型と、表示確認用のデモデータ。
// 仕様: docs/SONARIA_TEACHER_DIRECTORY_UI_SPEC_v1.0.md（承認済み B案）
//
// 重要: 本番には、本人の同意を得て審査・公開した講師だけを載せる（publishedTeachers）。
// デモデータは表示確認用の架空データで、プレビュー（GitHub Pages）のビルドでだけ使う。
// 本番ビルドには含めない（仕様 §7「No sample teacher cards on production」）。

export type InstrumentCategory = "piano" | "strings" | "woodwind" | "brass";
export type Instrument =
  | "piano"
  | "violin"
  | "viola"
  | "cello"
  | "doublebass"
  | "flute"
  | "oboe"
  | "clarinet"
  | "bassoon"
  | "trumpet"
  | "horn"
  | "trombone"
  | "tuba";
export type LessonFormat = "in_person" | "visiting" | "online";
export type Audience = "beginner" | "exam" | "adult" | "children";
// 性別は本人の任意の自己申告。undisclosed は性別の絞り込みに含めない（仕様 §3-4, §9）
export type GenderDisclosure = "female" | "male" | "other" | "undisclosed";

export const instrumentCategories: readonly InstrumentCategory[] = ["piano", "strings", "woodwind", "brass"];
export const lessonFormats: readonly LessonFormat[] = ["in_person", "visiting", "online"];
export const audiences: readonly Audience[] = ["beginner", "exam", "adult", "children"];

export const instrumentCategoryOf: Record<Instrument, InstrumentCategory> = {
  piano: "piano",
  violin: "strings",
  viola: "strings",
  cello: "strings",
  doublebass: "strings",
  flute: "woodwind",
  oboe: "woodwind",
  clarinet: "woodwind",
  bassoon: "woodwind",
  trumpet: "brass",
  horn: "brass",
  trombone: "brass",
  tuba: "brass",
};

export type ExternalLink = { label: string; url: string };

export type Teacher = {
  id: string;
  isDemo: boolean;
  displayName: { ja: string; en: string };
  nameKana: string;
  nameRomaji: string;
  instruments: readonly Instrument[];
  prefectureCode: string;
  station: { ja: string; en: string } | null;
  // 対応範囲。将来「最寄り駅から公共交通機関で約○分圏内」を扱うための項目
  travel: { mode: "transit"; minutes: number } | null;
  formats: readonly LessonFormat[];
  audiences: readonly Audience[];
  gender: GenderDisclosure;
  // 学歴は確認前は自己申告として表示する（確認済みと誤解させない）
  education: { ja: string; en: string; verified: boolean };
  intro: { ja: string; en: string };
  // https:// のみ。空なら外部リンクのボタン自体を出さない
  externalLinks: readonly ExternalLink[];
};

// 本番に載せる講師（審査済み・公開済み）。現在は 0 件
export const publishedTeachers: readonly Teacher[] = [];

const demoIntro = {
  ja: "これは表示確認用の架空データです。実在の講師ではありません。",
  en: "This is fictional sample data for layout testing. Not a real teacher.",
};

const demoTeachers: readonly Teacher[] = [
  { id: "demo-a", isDemo: true, displayName: { ja: "デモ講師 A", en: "Demo Teacher A" }, nameKana: "でもこうし えー", nameRomaji: "demo teacher a", instruments: ["violin", "viola"], prefectureCode: "13", station: { ja: "新宿", en: "Shinjuku" }, travel: { mode: "transit", minutes: 30 }, formats: ["in_person", "visiting"], audiences: ["beginner", "adult"], gender: "female", education: { ja: "音楽大学 卒業（自己申告）", en: "Music university graduate (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-b", isDemo: true, displayName: { ja: "デモ講師 B", en: "Demo Teacher B" }, nameKana: "でもこうし びー", nameRomaji: "demo teacher b", instruments: ["piano"], prefectureCode: "14", station: { ja: "横浜", en: "Yokohama" }, travel: null, formats: ["in_person", "online"], audiences: ["children", "exam"], gender: "male", education: { ja: "音楽大学 在学中（自己申告）", en: "Current music university student (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-c", isDemo: true, displayName: { ja: "デモ講師 C", en: "Demo Teacher C" }, nameKana: "でもこうし しー", nameRomaji: "demo teacher c", instruments: ["cello"], prefectureCode: "27", station: { ja: "梅田", en: "Umeda" }, travel: { mode: "transit", minutes: 45 }, formats: ["visiting"], audiences: ["adult"], gender: "undisclosed", education: { ja: "音楽大学 卒業（自己申告）", en: "Music university graduate (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-d", isDemo: true, displayName: { ja: "デモ講師 D", en: "Demo Teacher D" }, nameKana: "でもこうし でぃー", nameRomaji: "demo teacher d", instruments: ["flute"], prefectureCode: "23", station: { ja: "名古屋", en: "Nagoya" }, travel: null, formats: ["online"], audiences: ["beginner", "adult"], gender: "female", education: { ja: "音楽大学 卒業（自己申告）", en: "Music university graduate (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-e", isDemo: true, displayName: { ja: "デモ講師 E", en: "Demo Teacher E" }, nameKana: "でもこうし いー", nameRomaji: "demo teacher e", instruments: ["trumpet"], prefectureCode: "40", station: { ja: "博多", en: "Hakata" }, travel: { mode: "transit", minutes: 20 }, formats: ["in_person", "visiting"], audiences: ["children", "beginner"], gender: "male", education: { ja: "音楽大学 在学中（自己申告）", en: "Current music university student (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-f", isDemo: true, displayName: { ja: "デモ講師 F", en: "Demo Teacher F" }, nameKana: "でもこうし えふ", nameRomaji: "demo teacher f", instruments: ["violin"], prefectureCode: "13", station: { ja: "吉祥寺", en: "Kichijoji" }, travel: { mode: "transit", minutes: 40 }, formats: ["in_person", "online"], audiences: ["exam", "children"], gender: "other", education: { ja: "音楽大学 卒業（自己申告）", en: "Music university graduate (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-g", isDemo: true, displayName: { ja: "デモ講師 G", en: "Demo Teacher G" }, nameKana: "でもこうし じー", nameRomaji: "demo teacher g", instruments: ["clarinet", "bassoon"], prefectureCode: "26", station: { ja: "京都", en: "Kyoto" }, travel: null, formats: ["in_person"], audiences: ["adult"], gender: "undisclosed", education: { ja: "音楽大学 卒業（自己申告）", en: "Music university graduate (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
  { id: "demo-h", isDemo: true, displayName: { ja: "デモ講師 H", en: "Demo Teacher H" }, nameKana: "でもこうし えいち", nameRomaji: "demo teacher h", instruments: ["horn", "tuba"], prefectureCode: "11", station: { ja: "大宮", en: "Omiya" }, travel: { mode: "transit", minutes: 60 }, formats: ["visiting", "online"], audiences: ["beginner", "exam"], gender: "female", education: { ja: "音楽大学 在学中（自己申告）", en: "Current music university student (self-declared)", verified: false }, intro: demoIntro, externalLinks: [] },
];

// 画面で使う講師一覧。プレビューのときだけデモデータを使う。
// 環境変数をここで直接比較するのは、本番ビルドで条件が定数（false）に置き換わり、デモデータがバンドルから除かれるようにするため
const usesDemo = process.env.NEXT_PUBLIC_PREVIEW === "1";
export const teachers: readonly Teacher[] = usesDemo ? [...publishedTeachers, ...demoTeachers] : publishedTeachers;
export const showsDemoTeachers = usesDemo;

export function findTeacher(id: string): Teacher | undefined {
  return teachers.find((t) => t.id === id);
}
