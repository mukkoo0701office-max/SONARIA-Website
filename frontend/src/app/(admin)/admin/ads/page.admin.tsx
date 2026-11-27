import AdminShell from "@/admin/AdminShell";
import AdsView from "@/admin/views/AdsView";

// 管理画面（プレビュー用ビルドのみ）。中身はログイン後にブラウザ側で描く（静的 HTML にデータを書き出さない）
export default function Page() {
  return (
    <AdminShell>
      <AdsView />
    </AdminShell>
  );
}
