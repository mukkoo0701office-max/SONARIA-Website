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
  /** 迷惑な送信として一覧から外す（データは残る） */
  hideInquiry(id: string): Promise<void>;
  /** 完全に削除する（元に戻せない） */
  deleteInquiry(id: string): Promise<void>;
  listTemplates(): Promise<ReplyTemplate[]>;

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

export const caseStatuses: readonly CaseStatus[] = ["new", "scheduling", "quoted", "booked", "in_progress", "delivered", "completed", "cancelled"];
export const teacherStatuses: readonly TeacherApplicationStatus[] = ["submitted", "under_review", "changes_requested", "approved", "published", "unpublished", "rejected"];
