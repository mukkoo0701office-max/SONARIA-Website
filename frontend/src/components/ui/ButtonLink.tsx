import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
};

// ボタンの見た目のリンク。external は新しいタブで外部サイトを開く
export default function ButtonLink({ href, children, variant = "primary", external = false }: Props) {
  const className =
    variant === "primary"
      ? "inline-flex items-center gap-1 rounded-button border border-navy bg-navy px-5 py-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95"
      : "inline-flex items-center gap-1 rounded-button border border-line bg-card px-5 py-3 text-[13px] text-navy hover:bg-paper";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
