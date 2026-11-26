import { getDictionary } from "@/data/dictionaries";
import type { Locale } from "@/lib/i18n";

export default function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <footer className="mt-16 border-t border-line pt-4 text-xs text-muted">
      {/* TODO: プライバシーポリシー・利用規約・特定商取引法の表示（/legal/...）を追加する */}
      <p>{dict.footer.legalPending}</p>
      <p className="mt-2">{dict.footer.copyright}</p>
    </footer>
  );
}
