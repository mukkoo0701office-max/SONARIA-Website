// 構造化データ（JSON-LD）。ページに表示している内容と一致する項目だけを渡すこと（架空の評価・出版社などを書かない）
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // </script> の混入を防ぐため < をエスケープする
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
