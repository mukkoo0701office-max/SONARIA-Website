import type { Config } from "tailwindcss";

// 色の値は src/app/globals.css の CSS 変数が正本（docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md）。
// ここでは CSS 変数を Tailwind のクラス名に対応させるだけ。値を直書きしない。
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "var(--color-navy)",
        gold: "var(--color-gold)",
        paper: "var(--color-bg)",
        card: "var(--color-card)",
        muted: "var(--color-muted)",
        line: "var(--color-border)",
        subtle: "var(--color-subtle)",
        ink: "var(--color-ink)",
        "icon-muted": "var(--color-icon-muted)",
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
