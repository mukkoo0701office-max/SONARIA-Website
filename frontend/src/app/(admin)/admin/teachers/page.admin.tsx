import AdminShell from "@/admin/AdminShell";
import TeachersView from "@/admin/views/TeachersView";

// 管理画面（プレビュー用ビルドのみ）。中身はログイン後にブラウザ側で描く（静的 HTML にデータを書き出さない）
export default function Page() {
  return (
    <AdminShell>
      <TeachersView />
    </AdminShell>
  );
}
