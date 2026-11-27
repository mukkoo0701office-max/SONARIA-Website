// サイトで使う画像の一覧。
// 仮: いまは public/images/placeholders/ の抽象的な仮画像。本番画像に替えるときは、この一覧の src・width・height だけを書き換える。
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
  home: { src: "/images/placeholders/home.svg", width: 1600, height: 900 },
  scores: { src: "/images/placeholders/scores.svg", width: 1600, height: 900 },
  bowing: { src: "/images/placeholders/bowing.svg", width: 1600, height: 900 },
  lessons: { src: "/images/placeholders/lessons.svg", width: 1600, height: 900 },
  recording: { src: "/images/placeholders/recording.svg", width: 1600, height: 900 },
  performance: { src: "/images/placeholders/performance.svg", width: 1600, height: 900 },
  community: { src: "/images/placeholders/community.svg", width: 1600, height: 900 },
  profile: { src: "/images/placeholders/profile.svg", width: 1600, height: 900 },
};
