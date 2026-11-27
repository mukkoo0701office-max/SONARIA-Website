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
// 掲載の流れ（PR #24 §2）: 講師登録フォーム（/teachers/register/）で申請 → 管理人が確認 → 承認した講師だけを
// ここに手で追加する。申請データ（本名・メールなどの審査用情報）はリポジトリに保存しない。
// 公開を止めるときは、ここから削除する（運営者の承認が必要）
export const publishedTeachers: readonly Teacher[] = [];

// 表示確認用のデモデータ（src/data/teachers.demo.ts）。
// プレビューのビルドでだけ読み込む。条件はビルド時に定数（next.config.ts の env）になるため、
// 本番ビルドではこの require 自体が消え、デモデータはバンドルに含まれない（CI で確認している）。
const demoTeachers: readonly Teacher[] =
  process.env.NEXT_PUBLIC_PREVIEW === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./teachers.demo") as { demoTeachers: readonly Teacher[] }).demoTeachers
    : [];

// 画面で使う講師一覧
export const teachers: readonly Teacher[] = [...publishedTeachers, ...demoTeachers];
export const showsDemoTeachers = demoTeachers.length > 0;

export function findTeacher(id: string): Teacher | undefined {
  return teachers.find((t) => t.id === id);
}
