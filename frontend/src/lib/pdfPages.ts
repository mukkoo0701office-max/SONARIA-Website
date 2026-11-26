// PDF のページ数を読み取る（参考値）。
// 外部ライブラリを使わず、ファイル内の "/Type /Page" の数を数える簡易な方法。
// 圧縮されたオブジェクトストリームを使う PDF では数えられないことがあるので、その場合は null を返す。
// 最終的なページ数は申込者が入力する（指示書 v1.0 §4）。
export async function countPdfPages(file: File): Promise<number | null> {
  try {
    // 大きすぎるファイルは読まない（メモリ節約）
    if (file.size > 25 * 1024 * 1024) return null;
    const buf = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buf);
    const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
    return matches && matches.length > 0 ? matches.length : null;
  } catch {
    return null;
  }
}
