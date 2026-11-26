import type { Config } from "tailwindcss";

// 色の値は src/app/globals.css の CSS 変数が正本（docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md）。
// ここでは CSS 変数を Tailwind のクラス名に対応させるだけ。値を直書きしない。
// 透明度指定（bg-navy/80 など）が効くよう、RGB 値の変数（--rgb-*）を使う。
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "rgb(var(--rgb-navy) / <alpha-value>)",
        gold: "rgb(var(--rgb-gold) / <alpha-value>)",
        paper: "rgb(var(--rgb-bg) / <alpha-value>)",
        card: "rgb(var(--rgb-card) / <alpha-value>)",
        muted: "rgb(var(--rgb-muted) / <alpha-value>)",
        line: "rgb(var(--rgb-border) / <alpha-value>)",
        subtle: "rgb(var(--rgb-subtle) / <alpha-value>)",
        ink: "rgb(var(--rgb-ink) / <alpha-value>)",
        "icon-muted": "rgb(var(--rgb-icon-muted) / <alpha-value>)",
        danger: "rgb(var(--rgb-danger) / <alpha-value>)",
      },
      borderRadius: {
        card: "17px",
        control: "11px",
        button: "10px",
        tag: "7px",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Noto Sans JP"', "sans-serif"],
        // 仮: ロゴ原本が来るまでのブランド表記用
        brand: ["Georgia", "serif"],
      },
      maxWidth: {
        content: "780px",
        wide: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
