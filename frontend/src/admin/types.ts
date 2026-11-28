// 管理画面のデータモデル（将来のデータベース・API と同じ形を想定）。
// 設計: docs/admin/ADMIN_SYSTEM_DESIGN.md。PR #7 の Supabase スキーマ（applications など）とも対応づけられるようにしている。
// 金額は最小単位の整数（円なら 1 円単位）で持つ。日時は ISO 8601 文字列（UTC またはオフセット付き）

// 送信時の原文（Supabase の申し込みだけ。デモの一部にもある）
import type { RawSubmission } from "./replies/describe";
export type { RawSubmission };

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // YYYY-MM-DDTHH:mm:ss+09:00 など
export type Currency = "JPY" | "USD";
export type Locale = "ja" | "en";

/** データの由来。demo は表示確認用の架空データ（本番の実績として扱わない） */
export type DataSource = "demo" | "manual" | "csv_import" | "stripe" | "adsense" | "amazon_report" | "analytics_api" | "form";

// ── 管理者 ──────────────────────────────────────────────
export type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  role: "owner" | "staff";
  // 認証方式。現在は password のみを想定。将来 passkey（Face ID など）・totp を追加する
  authMethods: ("password" | "passkey" | "totp")[];
  lastLoginAt?: ISODateTime;
};

// ── 問い合わせ・案件 ─────────────────────────────────────
export type InquiryKind = "lesson" | "recording" | "performance" | "teacher" | "bowing" | "general";

/** 既読・返信の状態（案件の進行とは別に持つ） */
export type ReadState = "unread" | "read";
export type ReplyState = "unreplied" | "replied";

/** 案件の進行状況 */
export type CaseStatus = "new" | "scheduling" | "quoted" | "booked" | "in_progress" | "delivered" | "completed" | "cancelled";

export type PaymentStatus = "none" | "unbilled" | "billed" | "paid" | "overdue" | "refunded";


/** 返信の下書き（案件ごとに 1 件。自動保存） */
export type ReplyDraft = { purpose: string; locale: "ja" | "en"; selected: string[]; inputs: Record<string, string>; subject: string; body: string; updatedAt: string };

/** 対応記録（タイムライン）。occurredAt が空なら実際の日時は不明（recordedAt は記録した日時） */
export type ActivityKind = "reply_sent" | "email" | "line" | "phone" | "other" | "quote_sent" | "quote_changed" | "booked" | "invoiced" | "paid" | "refunded" | "completed" | "cancelled";
export type CaseActivity = { id: string; inquiryId: string; kind: ActivityKind; occurredAt?: string; recordedAt: string; note?: string; amount?: number; data: Record<string, unknown>; important: boolean };

export type Inquiry = {
  id: string;
  receiptNo: string; // 受付番号（例: SNR-20261127-0001）
  kind: InquiryKind;
  receivedAt: ISODateTime;
  updatedAt: ISODateTime;
  requester: { name: string; email: string };
  subject: string;
  body: string; // 送信内容（フォームの項目を整形したもの）
  fields: { label: string; value: string }[]; // フォームの項目
  readState: ReadState;
  replyState: ReplyState;
  caseStatus: CaseStatus;
  scheduledAt?: ISODateTime; // 演奏・レッスン・録音の実施日時
  dueDate?: ISODate; // 納品締切
  quote?: Quote;
  booking?: Booking;
  payment?: Payment;
  internalMemo: string;
  attachments: { name: string; size: number }[]; // 実ファイルは非公開ストレージ（未接続）
  source: DataSource;
  /** 送信時の原文（変更しない）。これがある案件では、整理表示と返信文の組み立てが使える */
  raw?: RawSubmission;
};

export type InquiryMessage = {
  id: string;
  inquiryId: string;
  direction: "inbound" | "outbound";
  status: "draft" | "queued" | "sent" | "failed" | "not_connected";
  subject: string;
  body: string;
  createdAt: ISODateTime;
  sentAt?: ISODateTime;
  templateId?: string;
};

export type InquiryStatusHistory = {
  id: string;
  inquiryId: string;
  from: CaseStatus | null;
  to: CaseStatus;
  note?: string;
  changedAt: ISODateTime;
  changedBy: string; // AdminUser.id
};

export type Quote = {
  amount: number; // 見積金額
  confirmedAmount?: number; // 確定金額
  currency: Currency;
  issuedAt?: ISODateTime;
  confirmedAt?: ISODateTime;
};

export type Booking = {
  startsAt: ISODateTime;
  endsAt?: ISODateTime;
  place?: string;
};

export type Payment = {
  status: PaymentStatus;
  dueDate?: ISODate;
  paidAt?: ISODateTime;
  amount?: number;
  fee?: number; // 決済手数料
};

export type ReplyTemplate = { id: string; name: Record<Locale, string>; subject: Record<Locale, string>; body: Record<Locale, string> };

// ── 収益 ──────────────────────────────────────────────
export type RevenueCategory = "adsense" | "amazon" | "recording" | "performance" | "lesson" | "donation" | "digital" | "other";

export type RevenueEntry = {
  id: string;
  category: RevenueCategory;
  inquiryId?: string; // 関連案件
  amount: number;
  currency: Currency;
  occurredOn: ISODate; // 発生日
  billedOn?: ISODate; // 請求日
  paidOn?: ISODate; // 入金日
  fee: number; // 手数料
  expense: number; // 経費
  refund: number; // 返金額
  paymentStatus: "unpaid" | "paid" | "refunded";
  source: DataSource; // データ取得元
  certainty: "estimated" | "confirmed"; // 推定値／確定値
  note?: string;
};

// ── 講師 ──────────────────────────────────────────────
export type TeacherApplicationStatus = "submitted" | "under_review" | "changes_requested" | "approved" | "published" | "unpublished" | "rejected";

export type TeacherApplication = {
  id: string;
  submittedAt: ISODateTime;
  updatedAt: ISODateTime;
  status: TeacherApplicationStatus;
  // 公開候補（承認後に TeacherProfile へ転記する）
  profile: TeacherProfile;
  // 非公開（審査・連絡用）。公開プロフィールと分けて保存する
  private: {
    legalName: string;
    email: string;
    verification: "not_requested" | "requested" | "received" | "verified";
    reviewerNote: string;
  };
  source: DataSource;
};

export type TeacherProfile = {
  displayName: string;
  nameKana: string;
  nameRomaji: string;
  photo?: string;
  education: { school: string; enrollment: "student" | "graduate"; department?: string; gradYear?: string };
  career?: string;
  instruments: string[];
  prefectureCode: string;
  station?: string;
  travel: { available: boolean; minutes?: number };
  formats: ("in_person" | "visiting" | "online")[];
  ageGroup?: string;
  videoUrls: string[];
  externalLinks: string[];
  intro: Record<Locale, string>;
  // 料金は持たない（公開ディレクトリに料金を出さない方針。CLAUDE.md）
};

// ── アクセス解析 ───────────────────────────────────────
export type AnalyticsMetric = {
  date: ISODate;
  path: string; // /ja/scores/ など
  locale: Locale;
  category: "home" | "scores" | "work" | "teachers" | "service" | "form" | "other";
  pageviews: number;
  visitors: number;
  source: DataSource;
};

export type TrafficBreakdown = { label: string; value: number }[];

// ── 通知 ──────────────────────────────────────────────
export type NotificationKind =
  | "new_inquiry"
  | "teacher_application"
  | "unreplied"
  | "booking_confirmed"
  | "delivery_due"
  | "payment_due"
  | "system_error"
  | "suspicious_pdf";

export type Notification = {
  id: string;
  kind: NotificationKind;
  createdAt: ISODateTime;
  title: string;
  relatedId?: string;
  channel: "email" | "dashboard";
  to?: string;
  delivery: "not_connected" | "queued" | "sent" | "failed";
  read: boolean;
};

export type NotificationSetting = { kind: NotificationKind; email: boolean; dashboard: boolean };

export type AuditLog = {
  id: string;
  at: ISODateTime;
  actor: string;
  action: string; // 例: inquiry.status_changed / teacher.published / pdf.policy_changed
  target?: string;
  detail?: string;
};

// ── PDF 保護 ──────────────────────────────────────────
export type PdfProtectionMode = "open" | "protected" | "strict";

export type PdfDownloadEvent = {
  id: string;
  at: ISODateTime;
  assetId: string;
  workId: string;
  clientHash: string; // IP などは保存せず、ハッシュ化した識別子だけを持つ（個人情報を減らす）
  userAgentFamily: string;
  country?: string;
  outcome: "served" | "rate_limited" | "blocked" | "challenged";
};

export type PdfAccessPolicy = {
  mode: PdfProtectionMode;
  perClientPerMinute: number;
  perClientPerDay: number;
  burstThreshold: number; // 短時間の大量取得とみなす件数
  blockKnownAiCrawlers: boolean;
  signedUrlTtlSeconds: number;
  notifyOnSuspicious: boolean;
  updatedAt: ISODateTime;
};

export type PdfAccessGrant = {
  id: string;
  clientName: string; // 例: 大学図書館のアーカイブ
  contact: string;
  scope: "all" | "works";
  workIds?: string[];
  dailyLimit: number;
  expiresOn?: ISODate;
  status: "active" | "revoked";
  createdAt: ISODateTime;
};

export type SuspiciousClient = {
  clientHash: string;
  userAgentFamily: string;
  country?: string;
  downloadsLastHour: number;
  distinctWorks: number;
  firstSeen: ISODateTime;
  lastSeen: ISODateTime;
  state: "watching" | "rate_limited" | "blocked" | "allowed";
  reason: string;
};

// ── カレンダー ─────────────────────────────────────────
export type CalendarEventKind = "performance" | "lesson" | "recording" | "delivery_due" | "payment_due" | "other";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  start: ISODateTime;
  end?: ISODateTime;
  allDay: boolean;
  inquiryId?: string;
  done: boolean;
};

// ── 広告（AdSense）──────────────────────────────────────
// 指標の出どころを区別する: adsense_api = AdSense Management API から取得（推定収益・表示回数・ページ RPM など）
//                          site = サイト内の計測から算出（PV・PDF ダウンロード数・ダウンロード率）
export type MetricOrigin = "adsense_api" | "site";

export type AdDailyMetric = {
  date: ISODate;
  estimatedEarnings: number; // AdSense の推定収益（確定前。月末に調整される）
  impressions: number; // 広告表示回数
  adsensePageviews: number; // AdSense が数えたページビュー（ページ RPM の分母）
  source: DataSource;
};

export type AdBreakdownRow = { key: string; label: string; estimatedEarnings: number; impressions: number; adsensePageviews: number };

export type AdReport = {
  launchDate: ISODate | null; // 広告を出し始めた日（導入前後の比較の基準）
  daily: AdDailyMetric[];
  byUnit: AdBreakdownRow[]; // 広告ユニット別
  byPage: AdBreakdownRow[]; // ページ別（AdSense の URL チャネル／ページ別レポート）
};

export type SiteDailyMetric = { date: ISODate; pageviews: number; pdfDownloads: number; workPageviews: number; source: DataSource };

export type AdSettings = {
  // SONARIA 側で管理する設定（data/ads.ts に反映する）
  adsenseEnabled: boolean;
  publisherId: string; // ca-pub-…
  pages: { work: boolean; composer: boolean; category: boolean };
  units: { id: string; page: "work"; placement: "after-downloads"; slot: string; enabled: boolean }[];
  amazonEnabled: boolean;
  // Google 側（AdSense の管理画面）で管理する設定の控え。サイトからは変更できない
  googleManaged: { autoAds: boolean; vignette: boolean; anchor: boolean; cmpConfigured: boolean; adsTxt: "missing" | "ok" };
  updatedAt: ISODateTime;
};
