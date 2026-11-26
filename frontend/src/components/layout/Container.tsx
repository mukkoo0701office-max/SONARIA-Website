// ページ本文の幅。narrow は承認済みの検索 UI と同じ 780px、wide はトップページ用
export default function Container({
  children,
  width = "narrow",
  className = "",
}: {
  children: React.ReactNode;
  width?: "narrow" | "wide";
  className?: string;
}) {
  const base = width === "wide" ? "mx-auto w-full max-w-wide px-4 lg:px-6" : "mx-auto w-full max-w-content px-3 sm:px-4";
  return <div className={`${base} ${className}`}>{children}</div>;
}
