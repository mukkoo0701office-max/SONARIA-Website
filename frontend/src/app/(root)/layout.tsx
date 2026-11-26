import type { Metadata } from "next";
import "../globals.css";

// トップページ（/）専用のルートレイアウト。
// 言語別ページは src/app/[locale]/layout.tsx が別のルートレイアウトになる（Next.js の複数ルートレイアウト）。
export const metadata: Metadata = {
  title: "SONARIA",
  robots: { index: false },
};

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
