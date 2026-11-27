import Script from "next/script";
import { ga4MeasurementId } from "@/data/analytics";

// GA4 のタグ。ページ遷移（クライアント側の画面切り替え）は GA4 の拡張計測機能が履歴の変化から自動で数える
// 本番ビルドだけで読み込む（data/analytics.ts）。管理画面は本番ビルドに含まれないため計測されない
export default function GoogleAnalytics() {
  const id = ga4MeasurementId();
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
