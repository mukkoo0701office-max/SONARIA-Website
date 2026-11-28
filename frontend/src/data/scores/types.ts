// 楽譜ライブラリのデータ型。
// 仕様: docs/SONARIA_FREE_SCORE_LIBRARY_AND_CATALOG_v1.0.md、楽譜ライブラリ自動生成・SEO／AI検索最適化仕様書 v1.0
//
// 構造: 作曲家マスター（composers.json）← 作品（catalog.json の works、composerId で参照）
//        → 版（Edition。権利の状態を持つ）→ ファイル（ScoreAsset。パート別の PDF）
// 方針: 確認できない項目は null／未設定のままにし、画面にも構造化データにも出さない（推測で埋めない）。

import type { Locale, LocalizedText } from "@/lib/i18n";

// ja・en は必須、他の言語は任意（表示は tr() で、未訳なら英語・日本語で補う）
export type Localized = LocalizedText;
export type PartialLocalized = Partial<Record<Locale, string>>;

/** 出典（作品情報・作曲家情報の根拠）。url が無い資料は書名などを label に書く */
export type SourceRef = { label: string; url?: string };

// ---- 作曲家マスター ------------------------------------------------------

export type Portrait = {
  file: string; // public/ からのパス
  width: number;
  height: number;
  alt: Localized;
  source: string; // 取得元のページ URL
  license: string; // 例: Public domain / CC BY-SA 4.0
  author?: string; // 作者・撮影者（ライセンスが表示を求める場合は必須）
};

export type ComposerProfileText = {
  position?: string; // 音楽史上の位置づけ
  life?: string; // 生涯の概要
  style?: string; // 音楽的特徴・作風
};

export type Composer = {
  id: string; // 例: beethoven
  name: { ja: string; en: string; original: string };
  short?: Localized; // ページタイトル・一覧で使う短い表記（例: ベートーヴェン / Beethoven）
  aliases?: string[]; // 検索用の別表記（例: ベートーベン, Beethoven）
  born?: string | null; // "1770" または "1770-12-17"
  died?: string | null;
  nationality?: Localized | null; // 国・活動地域
  era: Era;
  portrait?: Portrait | null;
  externalIds?: { wikidata?: string; musicbrainz?: string };
  profile?: Partial<Record<Locale, ComposerProfileText>>;
  notableWorks?: Localized[]; // 代表作品（収録の有無と無関係）
  related?: string[]; // 関連作曲家の id（収録作品がある作曲家だけリンクする）
  sources?: SourceRef[];
};

// ---- 作品 ----------------------------------------------------------------

export type Era = "baroque" | "classical" | "romantic" | "modern";

/** 楽器編成。カテゴリページはこの値と genre から自動で決まる */
export type Scoring =
  | "violin" // ヴァイオリン独奏（無伴奏）
  | "violin-piano"
  | "violin-duo"
  | "viola"
  | "viola-piano"
  | "cello"
  | "cello-piano"
  | "string-duo" // ヴァイオリン二重奏以外の弦楽二重奏
  | "string-trio"
  | "piano-trio"
  | "string-quartet"
  | "piano-quartet"
  | "string-quintet"
  | "piano-quintet"
  | "string-orchestra"
  | "solo-orchestra" // 独奏と管弦楽（協奏曲など）
  | "piano"
  | "other";

export type Genre = "concerto" | "sonata" | "chamber" | "suite" | "symphony" | "piece" | "etude" | "variations" | "other";

export type CatalogNumber = { type: "op" | "bwv" | "k" | "rv" | "hob" | "d" | "woo" | "other"; value: string };

export type WorkText = {
  overview: string; // 作品解説（歴史的背景・形式・調性など）
  features?: string; // 音楽的特徴
  performanceTips?: string; // 演奏上のポイント
};

export type Part = "score" | "violin1" | "violin2" | "violin" | "viola" | "cello" | "bass" | "piano" | "solo" | "other";

export type ScoreAsset = {
  id: string;
  part: Part;
  label?: Localized; // part が "other" のとき、または補足が必要なとき（例: 第2楽章のみ）
  file: string; // 本番で置くパス（public/ からのパス。例: /scores/kreisler-liebesleid/violin.pdf）
  remote?: string | null; // PDF 本体の保存先（GitHub のリリースの添付ファイル）。プレビューではここから取得する
  filename: string; // ダウンロード時のファイル名
  preview?: { file: string; width: number; height: number } | null; // 1 ページ目の画像
  sha256: string; // SONARIA で文書情報を書き込んだ後の値
  originalSha256?: string; // 旧サイトの PDF の値（検査記録との照合用）
  pages: number;
  bytes: number;
};

export type RightsStatus = "approved" | "pending" | "rejected";

export type Edition = {
  id: string;
  label: Localized; // 例: Carl Fischer（1910）
  publisher?: string | null;
  year?: string | null;
  editor?: string | null;
  source: { type: "imslp" | "own" | "other"; imslpFileId?: string | null; url?: string | null; note?: string | null };
  rights: {
    status: RightsStatus;
    basis: string; // 承認の根拠（作曲者・校訂者の没年、出典のライセンスなど）
    license?: string | null; // 表示が必要なライセンス（例: CC BY-SA 4.0）
    evidence?: string[]; // 権利確認の判断材料（検査で見つかった著作権表記・出版社など）。画面には出さない
    approvedBy?: string;
    approvedAt?: string;
  };
  assets: ScoreAsset[];
  oldSiteUrl?: string | null; // 旧サイトでの掲載ページ（移行の追跡用）
};

export type Work = {
  id: string; // URL に使う。英小文字・数字・ハイフン（例: beethoven-violin-sonata-5）
  composerId: string;
  title: { ja: string; en: string; original?: string | null };
  aliases?: string[]; // 一般的な別名（例: 春, Spring Sonata）
  summary?: Localized | null; // 2〜3 文の概要（workTexts.json。出典として作品の IMSLP ページを併記）
  catalog?: CatalogNumber[];
  key?: Localized | null; // 調性
  composed?: string | null; // 作曲年代（例: 1800–1801）
  scoring: Scoring;
  players: number;
  instruments: string[]; // 表示用の楽器名（英語の小文字。例: violin, piano）
  genre: Genre;
  era: Era;
  movements?: Localized[] | null;
  duration?: { minutes: number; source: SourceRef } | null; // 出典がある場合のみ
  difficulty?: { level: 1 | 2 | 3 | 4 | 5; basis: string } | null; // 根拠がある場合のみ
  text?: Partial<Record<Locale, WorkText>>; // 英語の解説がある作品だけ英語ページを作る
  sources?: SourceRef[];
  videos?: { title: string; url: string; note?: string }[]; // 権利上問題のない公式・公開音源のみ
  affiliate?: AffiliateLink[]; // 作品ごとの商品リンク（無ければ共通の枠設定を使う）
  featured?: boolean; // 運営者が選ぶ「おすすめ」（人気の数値を作らない）
  publishedAt: string; // SONARIA で公開した日
  updatedAt: string;
  changelog?: { date: string; note: string }[];
  editions: Edition[];
};

export type AffiliateLink = {
  label: string;
  url: string; // https:// のみ
  provider?: string; // 例: Amazon, 楽天ブックス
  note?: string;
};

export type Catalog = { version: number; generatedAt: string | null; works: Work[] };
