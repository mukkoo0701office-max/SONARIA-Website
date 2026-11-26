import type { Metadata } from "next";
import "../../globals.css";

// 管理画面専用のルートレイアウト（一般のヘッダー・フッターは出さない）。
// URL を隠すことで守るのではなく、データはデータベースの RLS で管理人だけに限定している。
export const metadata: Metadata = {
  title: "SONARIA 管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-paper">{children}</body>
    </html>
  );
}
