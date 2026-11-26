import Link from "next/link";
import WorkList from "@/components/library/WorkList";
import { getDictionary } from "@/data/dictionaries";
import { categories, categoryLocales, composerLocales, featuredWorks, newestWorks, publishedComposers, worksByComposer } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { localizedPath, type Locale } from "@/lib/i18n";

// 楽譜検索ページの下に出す「作曲家から探す」「編成・曲種から探す」「おすすめ」「新着」。
// 生成済み HTML にリンクが含まれるよう、サーバー側で描画する（検索エンジンが作品ページへたどれる）
export default function LibraryBrowse({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).library;
  if (publishedComposers.length === 0) return null;
  const chip = "inline-block rounded-full border border-line bg-card px-3 py-1.5 text-[13px] hover:border-navy";
  return (
    <div className="mt-10 grid gap-8 border-t border-line pt-8">
      {featuredWorks.length > 0 && (
        <section aria-labelledby="featured">
          <h2 id="featured" className="mb-3 text-lg font-bold">
            {t.browse.featured}
          </h2>
          <WorkList works={featuredWorks.slice(0, 6)} locale={locale} />
        </section>
      )}
      <section aria-labelledby="newest">
        <h2 id="newest" className="mb-3 text-lg font-bold">
          {t.browse.newest}
        </h2>
        <WorkList works={newestWorks(6)} locale={locale} />
      </section>
      <section aria-labelledby="by-composer">
        <h2 id="by-composer" className="mb-3 text-lg font-bold">
          <Link href={localizedPath(locale, libraryPaths.composers)} className="hover:underline">
            {t.browse.byComposer}
          </Link>
        </h2>
        <ul className="flex flex-wrap gap-2">
          {publishedComposers.map((c) => (
            <li key={c.id}>
              <Link href={localizedPath(composerLocales(c).includes(locale) ? locale : "ja", libraryPaths.composer(c.id))} className={chip}>
                {(c.short ?? c.name)[locale]} <span className="text-muted">({worksByComposer(c.id).length})</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {categories.length > 0 && (
        <section aria-labelledby="by-category">
          <h2 id="by-category" className="mb-3 text-lg font-bold">
            {t.browse.byCategory}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={localizedPath(categoryLocales(c.id).includes(locale) ? locale : "ja", libraryPaths.category(c.id))} className={chip}>
                  {c.name[locale]} <span className="text-muted">({c.works.length})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
