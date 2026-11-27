// サイトで使う画像の一覧。
// public/images/site/ は旧サイト（https://www.mukkoo0701music.jp/）で使っていた写真（運営者の指示で流用。文字入りのバナーは使わない）。
// lesson-desk-music-stand / recording-studio-mic / concert-hall-stage は運営者から提供された写真（2026-11-27）。
// public/images/placeholders/ は抽象的な仮画像。写真に替えるときは、この一覧の src・width・height（と focus）だけを書き換える。
// 画像の代替テキスト（alt）は dictionaries 側（images.alt）で日英それぞれ管理する。
export type ImageKey = "home" | "scores" | "bowing" | "lessons" | "recording" | "performance" | "community" | "profile";

export type SiteImage = {
  src: string; // public/ からのパス（basePath は withBasePath で付ける）
  width: number;
  height: number;
  // 細長く切り抜くとき（下層ページの見出し画像）に残したい位置（CSS の object-position。例: "50% 30%"）
  focus?: string;
};

export const siteImages: Record<ImageKey, SiteImage> = {
  home: { src: "/images/site/violin-scroll-score.jpg", width: 960, height: 640, focus: "60% 50%" },
  scores: { src: "/images/site/violin-and-bow-on-score.jpg", width: 750, height: 1107, focus: "50% 40%" },
  // 弓の写っている下の方を残す
  bowing: { src: "/images/site/violin-and-bow-on-score.jpg", width: 750, height: 1107, focus: "50% 88%" },
  // 横長の写真はスマホのスライド（縦長）で左右が切れる。主役（譜面台・マイク）が残る位置を focus で指定
  lessons: { src: "/images/site/lesson-desk-music-stand.jpg", width: 1920, height: 640, focus: "12% 50%" },
  recording: { src: "/images/site/recording-studio-mic.jpg", width: 1920, height: 640, focus: "85% 45%" },
  performance: { src: "/images/site/concert-hall-stage.jpg", width: 1920, height: 640, focus: "50% 60%" },
  community: { src: "/images/placeholders/community.svg", width: 1600, height: 900 },
  profile: { src: "/images/site/violin-scroll-score.jpg", width: 960, height: 640, focus: "50% 45%" },
};

// 管理人の写真（管理人プロフィールのページだけで使う。CLAUDE.md: 個人を前面に出すのはプロフィールと法定表示のみ）
export const curatorPortrait: SiteImage = { src: "/images/site/curator-portrait.jpg", width: 495, height: 400 };
