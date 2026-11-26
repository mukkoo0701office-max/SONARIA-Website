export default function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-tag bg-subtle px-2 py-[5px] text-[11px]">{children}</span>;
}
