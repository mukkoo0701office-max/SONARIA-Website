import type { Dictionary } from "@/data/dictionaries/types";

// ナビゲーション。表示名は dictionaries の nav から取る
export const navItems: readonly { key: Exclude<keyof Dictionary["nav"], "mainNavLabel">; path: string }[] = [
  { key: "home", path: "/" },
  { key: "scores", path: "/scores/" },
  { key: "teachers", path: "/teachers/" },
  { key: "about", path: "/about/" },
];
