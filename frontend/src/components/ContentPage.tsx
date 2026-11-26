import Link from "next/link";
import Container from "@/components/layout/Container";
import { getDictionary } from "@/data/dictionaries";
import type { ContentCopy } from "@/data/dictionaries/types";
import { siteImages, type ImageKey } from "@/data/images";
import { localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

type Props = {
  locale: Locale;
  copy: ContentCopy;
  image?: ImageKey;
  children?: React.ReactNode; // ページ下部のボタン・リンク
};

// サービス・紹介ページの共通レイアウト（見出しごとの段落・箇条書き）
export default function ContentPage({ locale, copy, image, children }: Props) {
  const dict = getDictionary(locale);
  const img = image ? siteImages[image] : null;

  return (
    <Container width="wide" className="py-8 lg:py-12">
      <article className="overflow-hidden rounded-card border border-line bg-card">
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
        <div className="mx-auto max-w-3xl p-6 sm:p-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{copy.title}</h1>
          <p className="mt-4 text-sm leading-relaxed sm:text-base">{copy.lead}</p>

          {copy.sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="border-l-[3px] border-gold pl-3 text-base font-bold sm:text-lg">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-[14px] leading-relaxed sm:text-[15px]">
                  {paragraph}
                </p>
              ))}
              {section.items &&
                (section.ordered ? (
                  <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[14px] leading-relaxed sm:text-[15px]">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed sm:text-[15px]">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ))}
            </section>
          ))}

          {copy.footnote && <p className="mt-8 rounded-button bg-paper p-4 text-[13px] leading-relaxed text-muted">{copy.footnote}</p>}

          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}

          <Link href={localizedPath(locale, "/")} className="mt-8 inline-block text-[13px] text-navy underline">
            {dict.common.backToHome}
          </Link>
        </div>
      </article>
    </Container>
  );
}
