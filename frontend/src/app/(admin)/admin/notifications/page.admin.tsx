import AdminShell from "@/admin/AdminShell";
import NotificationsView from "@/admin/views/NotificationsView";

// 管理画面（プレビュー用ビルドのみ）。中身はログイン後にブラウザ側で描く（静的 HTML にデータを書き出さない）
export default function Page() {
  return (
    <AdminShell>
      <NotificationsView />
    </AdminShell>
  );
}
