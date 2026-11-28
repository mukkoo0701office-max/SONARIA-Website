import Link from "next/link";
import { defaultLocale, localeConfig, locales } from "@/lib/i18n";

// 本番（さくら）ではビルド時に作る .htaccess（scripts/htaccess.mjs）が / を公開中の言語へ振り分けるため、このページは表示されない。
// .htaccess が効かない環境（開発サーバ・ローカル確認）向けの予備の振り分け。
// 判定順は .htaccess と同じ: Cookie（本人が選んだ言語）→ ブラウザの言語。
// プレビュー（GitHub Pages）ではサブパス配下になるため、basePath を付けて移動する。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// 公開中の言語だけを対象にする（言語を公開すると自動で増える）
const published = JSON.stringify(locales);
const redirectScript = `(function(){var b=${JSON.stringify(basePath)};var L=${published};var m=document.cookie.match(/(?:^|; )sonaria_lang=([A-Za-z-]+)(?:;|$)/);var l=m&&L.indexOf(m[1])>=0?m[1]:null;if(!l){var n=(navigator.language||"").toLowerCase();for(var i=0;i<L.length;i++){if(n.indexOf(L[i].toLowerCase())===0){l=L[i];break;}}}if(!l)l=${JSON.stringify(defaultLocale === "ja" ? "en" : defaultLocale)};location.replace(b+"/"+l+"/");})();`;

export default function RootPage() {
  return (
    <main className="mx-auto max-w-content px-4 py-16 text-center">
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <p className="font-brand text-3xl tracking-[0.06em]">SONARIA</p>
      <ul className="mt-8 flex justify-center gap-6">
        {locales.map((l) => (
          <li key={l}>
            <Link className="text-navy underline" href={`/${l}/`} lang={localeConfig(l).htmlLang}>
              {localeConfig(l).nativeName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
