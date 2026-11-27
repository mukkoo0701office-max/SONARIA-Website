import AdminShell from "@/admin/AdminShell";
import DashboardView from "@/admin/views/DashboardView";

// 管理画面（プレビュー用ビルドのみ）。中身はログイン後にブラウザ側で描く（静的 HTML にデータを書き出さない）
export default function Page() {
  return (
    <AdminShell>
      <DashboardView />
    </AdminShell>
  );
}
