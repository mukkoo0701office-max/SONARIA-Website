// 管理画面のデータ取得・更新の窓口。画面はこのインターフェースだけを使う。
// 現在の実装は「デモ（表示確認用の架空データ、ブラウザのメモリ内だけ）」のみ。
// 将来はサーバー側（認証済みの管理者 API）に接続する実装を追加し、getAdminRepository() で切り替える。
// 注: 本番のデータを静的な HTML／JavaScript に埋め込んではいけない（docs/admin/ADMIN_SYSTEM_DESIGN.md）

import type {
  AdReport,
  AdSettings,
  SiteDailyMetric,
  AnalyticsMetric,
  AuditLog,
  CalendarEvent,
  CaseStatus,
  Inquiry,
  InquiryMessage,
  InquiryStatusHistory,
  Notification,
  NotificationSetting,
  PdfAccessGrant,
  PdfAccessPolicy,
  PdfDownloadEvent,
  ReplyTemplate,
  RevenueEntry,
  SuspiciousClient,
  TeacherApplication,
  TeacherApplicationStatus,
  TrafficBreakdown,
  ActivityKind,
  CaseActivity,
  ReplyDraft,
  PaymentRecord,
  PriceItem,
  Currency,
} from "./types";

export type RepositoryKind = "demo" | "server";

export type InquiryPatch = Partial<Pick<Inquiry, "readState" | "replyState" | "caseStatus" | "scheduledAt" | "dueDate" | "quote" | "payment" | "internalMemo">>;

export interface AdminRepository {
  readonly kind: RepositoryKind;

  listInquiries(): Promise<Inquiry[]>;
  getInquiry(id: string): Promise<Inquiry | null>;
  updateInquiry(id: string, patch: InquiryPatch, note?: string): Promise<Inquiry>;
  listMessages(inquiryId: string): Promise<InquiryMessage[]>;
  saveDraft(inquiryId: string, draft: Pick<InquiryMessage, "subject" | "body" | "templateId">): Promise<InquiryMessage>;
  /** 返信を送る。メール送信サービスが未接続なら status: "not_connected" を返し、送ったことにしない */
  sendReply(inquiryId: string, draft: Pick<InquiryMessage, "subject" | "body" | "templateId">): Promise<InquiryMessage>;
  listStatusHistory(inquiryId: string): Promise<InquiryStatusHistory[]>;
  /** 返信の下書き（自動保存） */
  getReplyDraft(inquiryId: string): Promise<ReplyDraft | null>;
  saveReplyDraft(inquiryId: string, draft: Omit<ReplyDraft, "updatedAt">): Promise<void>;
  /** 対応記録（requestId で二重保存を防ぐ） */
  addActivity(inquiryId: string, a: { kind: ActivityKind; requestId: string; note?: string; amount?: number; occurredAt?: string; data?: Record<string, unknown> }): Promise<void>;
  listActivities(inquiryId: string): Promise<CaseActivity[]>;
  /** 迷惑な送信として一覧から外す（データは残る） */
  hideInquiry(id: string): Promise<void>;
  /** 完全に削除する（元に戻せない） */
  deleteInquiry(id: string): Promise<void>;
  listTemplates(): Promise<ReplyTemplate[]>;

  // 料金・決済（docs/payments/PAYMENTS_DESIGN.md）
  /** 料金マスタ（履歴を含む全行） */
  listPrices(): Promise<PriceItem[]>;
  /** 料金の追加・改定（有効開始日は今日以降。過去の行は書き換えない） */
  addPrice(p: Omit<PriceItem, "id" | "createdAt">): Promise<PriceItem>;
  /** 金額の確定（決済済みなら拒否される。未払いの古い請求は取り消される） */
  confirmPrice(inquiryId: string, amount: number, currency: Currency, note?: string): Promise<Inquiry>;
  listPayments(inquiryId: string): Promise<PaymentRecord[]>;
  /** 添付ファイルを開く URL（短時間だけ有効）。ファイルの保存先が無い環境では null */
  attachmentUrl(path: string): Promise<string | null>;
  // 銀行振込の手動管理（Phase 4）。requestId は同じ操作の再送を 1 回にまとめるための ID（画面で 1 操作ごとに作る）
  /** 振込案内を送ったことの記録（確定金額・円のみ）。案件は「入金待ち」へ */
  recordBankNotice(inquiryId: string, requestId: string, note?: string): Promise<PaymentRecord>;
  /** 着金の記録（金額・着金日）。合計で 入金済み／不足／超過 が付く。全額で案件は「入金済み」へ */
  recordBankReceipt(paymentId: string, amount: number, receivedOn: string, requestId: string, note?: string): Promise<PaymentRecord>;
  /** 振込で返金したことの記録 */
  recordBankRefund(paymentId: string, amount: number, requestId: string, note?: string): Promise<PaymentRecord>;
  /** 未払いの請求の取り消し */
  cancelPayment(paymentId: string, note?: string): Promise<PaymentRecord>;

  listTeacherApplications(): Promise<TeacherApplication[]>;
  setTeacherStatus(id: string, status: TeacherApplicationStatus, note?: string): Promise<TeacherApplication>;

  listRevenue(): Promise<RevenueEntry[]>;

  listAnalytics(fromISO: string, toISO: string): Promise<AnalyticsMetric[]>;
  trafficBreakdown(kind: "referrer" | "device" | "country"): Promise<TrafficBreakdown>;
  scoreDownloads(): Promise<{ workId: string; title: string; downloads: number }[]>;
  formFunnel(): Promise<{ kind: string; views: number; submissions: number }[]>;

  listCalendarEvents(): Promise<CalendarEvent[]>;

  listNotifications(): Promise<Notification[]>;
  getNotificationSettings(): Promise<{ email: string; settings: NotificationSetting[] }>;
  saveNotificationSettings(settings: NotificationSetting[]): Promise<void>;

  getPdfPolicy(): Promise<PdfAccessPolicy>;
  savePdfPolicy(policy: PdfAccessPolicy): Promise<PdfAccessPolicy>;
  listPdfEvents(): Promise<PdfDownloadEvent[]>;
  listSuspiciousClients(): Promise<SuspiciousClient[]>;
  setClientState(clientHash: string, state: SuspiciousClient["state"]): Promise<void>;
  listPdfGrants(): Promise<PdfAccessGrant[]>;
  saveGrant(grant: Omit<PdfAccessGrant, "id" | "createdAt" | "status">): Promise<PdfAccessGrant>;
  revokeGrant(id: string): Promise<void>;

  listAuditLog(): Promise<AuditLog[]>;

  // 広告（AdSense の指標は AdSense Management API、PV・ダウンロードはサイト内の計測から。どちらも未接続）
  getAdReport(fromISO: string, toISO: string): Promise<AdReport>;
  siteDaily(fromISO: string, toISO: string): Promise<SiteDailyMetric[]>;
  getAdSettings(): Promise<AdSettings>;
  saveAdSettings(settings: AdSettings): Promise<AdSettings>;
}

export const caseStatuses: readonly CaseStatus[] = ["new", "scheduling", "quoted", "awaiting_payment", "paid", "booked", "in_progress", "delivered", "completed", "cancelled"];
export const teacherStatuses: readonly TeacherApplicationStatus[] = ["submitted", "under_review", "changes_requested", "approved", "published", "unpublished", "rejected"];
