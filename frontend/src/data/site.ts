import type { ImageKey } from "@/data/images";

// ページの一覧。ナビ・スライド・フッター・仮ページはここを参照する
export type PageKey =
  | "home"
  | "scores"
  | "bowing"
  | "lessons"
  | "recording"
  | "performance"
  | "community"
  | "profile"
  | "teachers"
  | "teacherRegister"
  | "about"
  | "contact"
  | "apply"
  | "privacy"
  | "commerce";

export const pagePaths: Record<PageKey, string> = {
  home: "/",
  scores: "/scores/",
  bowing: "/bowing/",
  lessons: "/lessons/",
  recording: "/recording/",
  performance: "/performance/",
  community: "/community/",
  profile: "/profile/",
  teachers: "/teachers/",
  teacherRegister: "/teachers/register/",
  about: "/about/",
  contact: "/contact/",
  apply: "/apply/",
  privacy: "/legal/privacy/",
  // 特定商取引法に基づく表示（決済の導入に合わせて追加）
  commerce: "/legal/commerce/",
};

// ヘッダーのナビ（トップページ改修指示書 v1.0 §2 の順序）
export const headerNav: readonly PageKey[] = [
  "home",
  "scores",
  "bowing",
  "lessons",
  "recording",
  "performance",
  "community",
  "profile",
];

// トップページのメインビジュアル（指示書 §3 の順序）。文言は dictionaries の hero.slides
export const heroSlides: readonly { key: PageKey; image: ImageKey }[] = [
  { key: "home", image: "home" },
  { key: "scores", image: "scores" },
  { key: "bowing", image: "bowing" },
  { key: "lessons", image: "lessons" },
  { key: "recording", image: "recording" },
  { key: "performance", image: "performance" },
  { key: "community", image: "community" },
  { key: "profile", image: "profile" },
];

// フッターのサイト内リンク
export const footerNav: readonly PageKey[] = [
  "scores",
  "teachers",
  "bowing",
  "lessons",
  "recording",
  "performance",
  "community",
  "about",
  "profile",
];

// SNS。url が null のものはリンクにしない（クリックしても移動しない）
// TODO: 正式な URL が決まったら設定する（https:// のみ）
export type SocialKey = "x" | "instagram" | "youtube";
export const socialLinks: readonly { key: SocialKey; label: string; url: string | null }[] = [
  { key: "x", label: "X", url: null },
  { key: "instagram", label: "Instagram", url: null },
  { key: "youtube", label: "YouTube", url: null },
];

// 管理人の執筆・発信の場（管理人プロフィールのページだけで使う。CLAUDE.md: 個人を前面に出すのはプロフィールのみ）
// 運営者の指示（2026-11-27）。X の URL は共有用の「?s=11」を除いた正規の形にしている
export const curatorChannels = [
  { key: "note", url: "https://note.com/2108113" },
  { key: "x", url: "https://x.com/2108113" },
] as const;
export type CuratorChannelKey = (typeof curatorChannels)[number]["key"];

// 外部サイト
export const externalLinks = {
  // 向山弦楽コミュニティの既存サイト（docs/SONARIA_PROJECT_VISION.md §5）
  community: "https://mukstrings.mints.ne.jp/",
} as const;
