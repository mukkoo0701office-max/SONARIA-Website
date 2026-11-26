import Link from "next/link";

// 本番（さくら）では public/.htaccess が / を /ja/ か /en/ に振り分けるため、このページは表示されない。
// .htaccess が効かない環境（開発サーバ・ローカル確認）向けの予備の振り分け。
// 判定順は .htaccess と同じ: Cookie（本人が選んだ言語）→ ブラウザの言語。
// プレビュー（GitHub Pages）ではサブパス配下になるため、basePath を付けて移動する。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const redirectScript = `(function(){var b=${JSON.stringify(basePath)};var m=document.cookie.match(/(?:^|; )sonaria_lang=(ja|en)(?:;|$)/);var l=m?m[1]:((navigator.language||"").toLowerCase().indexOf("ja")===0?"ja":"en");location.replace(b+"/"+l+"/");})();`;

export default function RootPage() {
  return (
    <main className="mx-auto max-w-content px-4 py-16 text-center">
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <p className="font-brand text-3xl tracking-[0.06em]">SONARIA</p>
      <ul className="mt-8 flex justify-center gap-6">
        <li>
          <Link className="text-navy underline" href="/ja/" lang="ja">
            日本語
          </Link>
        </li>
        <li>
          <Link className="text-navy underline" href="/en/" lang="en">
            English
          </Link>
        </li>
      </ul>
    </main>
  );
}
