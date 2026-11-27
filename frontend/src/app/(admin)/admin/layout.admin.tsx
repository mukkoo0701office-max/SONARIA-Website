import type { Metadata } from "next";
import { AdminProvider } from "@/admin/AdminContext";
import "../../globals.css";

// 管理画面のルートレイアウト（公開サイトのヘッダー・フッターを出さない）。
// 【重要】このディレクトリのファイルは拡張子が .admin.tsx で、SONARIA_ADMIN_PREVIEW=1 のビルドでだけページになる
// （next.config.ts の pageExtensions）。本番・Pages のビルドには管理画面もデモデータも含まれない（CI で検査）。
// 本番で使えるようにするのは、サーバー側の認証（docs/admin/ADMIN_SYSTEM_DESIGN.md）を実装し、運営者が承認してから
export const metadata: Metadata = {
  title: "SONARIA Admin",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-paper text-ink">
        <AdminProvider>{children}</AdminProvider>
      </body>
    </html>
  );
}
