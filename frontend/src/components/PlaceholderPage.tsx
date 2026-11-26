import Link from "next/link";
import Container from "@/components/layout/Container";
import { getDictionary } from "@/data/dictionaries";
import type { PlaceholderCopy } from "@/data/dictionaries/types";
import { siteImages, type ImageKey } from "@/data/images";
import { localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

type Props = {
  locale: Locale;
  copy: PlaceholderCopy;
  image?: ImageKey;
  children?: React.ReactNode;
};

// 未完成ページの仮ページ（リンク切れを防ぐ。トップページ改修指示書 §2・§9）
export default function PlaceholderPage({ locale, copy, image, children }: Props) {
  const dict = getDictionary(locale);
  const img = image ? siteImages[image] : null;

  return (
    <Container width="wide" className="py-8 lg:py-12">
      <div className="overflow-hidden rounded-card border border-line bg-card">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image の最適化は使えない
          <img
            src={withBasePath(img.src)}
            width={img.width}
            height={img.height}
            alt={image ? dict.images.alt[image] : ""}
            decoding="async"
            className="aspect-[16/9] w-full object-cover sm:aspect-[21/7]"
          />
        )}
        <div className="p-6 sm:p-10">
          <span className="inline-block rounded-tag bg-subtle px-2 py-[3px] text-[11px]">{dict.common.comingSoon}</span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{copy.title}</h1>
          <p className="mt-3 text-sm leading-relaxed sm:text-base">{copy.lead}</p>
          <div className="mt-6 grid max-w-2xl gap-3 text-[13px] leading-relaxed text-muted sm:text-sm">
            {copy.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {children}
          <Link href={localizedPath(locale, "/")} className="mt-8 inline-block text-[13px] text-navy underline">
            {dict.common.backToHome}
          </Link>
        </div>
      </div>
    </Container>
  );
}
