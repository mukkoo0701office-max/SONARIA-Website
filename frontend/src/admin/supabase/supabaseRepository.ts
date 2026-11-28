// 管理画面のデータ窓口（Supabase 版）。public.submissions を管理画面の型（Inquiry・TeacherApplication）に変換する。
// 接続済み: 問い合わせ・案件（一覧・詳細・状態・既読/返信・メモ・運営側の項目・履歴）、講師申請（一覧・状態）、料金マスタ・金額の確定・決済の記録（読み取り）
// 未接続: 返信メールの送信・収益・アクセス解析・カレンダー・通知・PDF 保護・広告。
//   未接続の項目は空のデータを返す（架空のデータを本番の管理画面に混ぜない）。保存はエラーにする

import type { AdminRepository, InquiryPatch } from "../repository";
import type {
  ActivityKind,
  AdSettings,
  CaseActivity,
  CaseStatus,
  Inquiry,
  InquiryKind,
  InquiryMessage,
  InquiryStatusHistory,
  PaymentRecord,
  PdfAccessPolicy,
  PriceItem,
  ServerQuote,
  ReplyDraft,
  TeacherApplication,
  TeacherApplicationStatus,
  TeacherProfile,
} from "../types";
import { rest, SupabaseError } from "./client";

type Row = {
  id: string;
  receipt_no: string;
  kind: "lesson" | "bowing" | "recording" | "performance_quote" | "teacher_application";
  status: string;
  locale: "ja" | "en";
  contact_name: string;
  contact_email: string;
  payload: Record<string, unknown>;
  client_estimate: number | null;
  created_at: string;
  updated_at: string;
  admin_note: string | null;
  read_at: string | null;
  replied_at: string | null;
  admin_data: Record<string, unknown>;
  // 料金・決済（20261128000005_pricing_payments.sql）。この列がない古いデータベースでは undefined
  region?: "jp" | "intl" | null;
  region_detected?: string | null;
  currency?: "JPY" | "USD" | null;
  payment_method?: "card" | "bank_transfer" | null;
  server_quote?: Record<string, unknown> | null;
  confirmed_amount?: number | null;
  confirmed_currency?: "JPY" | "USD" | null;
  confirmed_at?: string | null;
};
type PriceRowDb = { id: string; service: string; item: string; mode: PriceItem["mode"]; jpy: number | null; usd_cents: number | null; effective_from: string; active: boolean; note: string | null; created_at: string };
type PaymentRowDb = {
  id: string; submission_id: string; purpose: PaymentRecord["purpose"]; method: PaymentRecord["method"]; currency: PaymentRecord["currency"]; amount: number; status: PaymentRecord["status"];
  received_amount: number | null; refunded_amount: number; notified_at: string | null; paid_at: string | null; checkout_url: string | null; expires_at: string | null; note: string | null; created_at: string;
};
const toPrice = (r: PriceRowDb): PriceItem => ({ id: r.id, service: r.service, item: r.item, mode: r.mode, jpy: r.jpy, usdCents: r.usd_cents, effectiveFrom: r.effective_from, active: r.active, note: r.note ?? undefined, createdAt: r.created_at });
const toPayment = (r: PaymentRowDb): PaymentRecord => ({
  id: r.id, inquiryId: r.submission_id, purpose: r.purpose, method: r.method, currency: r.currency, amount: r.amount, status: r.status,
  receivedAmount: r.received_amount ?? undefined, refundedAmount: r.refunded_amount, notifiedAt: r.notified_at ?? undefined, paidAt: r.paid_at ?? undefined,
  checkoutUrl: r.checkout_url ?? undefined, expiresAt: r.expires_at ?? undefined, note: r.note ?? undefined, createdAt: r.created_at,
});
type EventRow = { id: string; submission_id: string; from_status: string | null; to_status: string; note: string | null; changed_at: string; changed_by: string | null };

const KIND: Record<Row["kind"], InquiryKind> = { lesson: "lesson", bowing: "bowing", recording: "recording", performance_quote: "performance", teacher_application: "teacher" };
const CASE: readonly string[] = ["new", "scheduling", "quoted", "awaiting_payment", "paid", "booked", "in_progress", "delivered", "completed", "cancelled"];
const TEACHER: readonly string[] = ["submitted", "under_review", "changes_requested", "approved", "published", "unpublished", "rejected"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

// フォームの入力内容を「項目: 値」の一覧にする（入れ子は a.b の形）。連絡先は requester に別に出すので除く
function flatten(v: unknown, prefix = "", out: { label: string; value: string }[] = []) {
  if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (prefix === "" && ["contact", "customer", "private", "agreements", "consent", "locale", "kind", "service", "createdAt", "status", "estimateTotal", "currency", "billingRegion", "paymentMethod"].includes(k)) continue;
      flatten(x, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (Array.isArray(v)) {
    if (v.every((x) => !isObj(x) && !Array.isArray(x))) out.push({ label: prefix, value: v.map(str).join(", ") || "—" });
    else v.forEach((x, i) => flatten(x, `${prefix}[${i + 1}]`, out));
  } else {
    const s = str(v).trim();
    if (s !== "") out.push({ label: prefix, value: s });
  }
  return out;
}

// 一覧で見分けやすい件名（フォームの主な選択肢から作る）
function subjectOf(r: Row): string {
  const p = r.payload;
  const pick = (o: unknown, ...keys: string[]) => (isObj(o) ? keys.map((k) => str(o[k])).filter(Boolean).join(" / ") : "");
  const s =
    r.kind === "performance_quote"
      ? pick(p, "ensemble", "budget")
      : r.kind === "lesson"
        ? pick(p.lesson, "plan")
        : r.kind === "bowing"
          ? pick(p.bowing, "type", "pages")
          : r.kind === "recording"
            ? pick(p.recording, "delivery")
            : pick(p.public, "displayName");
  return s ? `${r.receipt_no} · ${s}` : r.receipt_no;
}

function toInquiry(r: Row): Inquiry {
  const fields = flatten(r.payload);
  const a = r.admin_data ?? {};
  return {
    id: r.id,
    receiptNo: r.receipt_no,
    kind: KIND[r.kind],
    receivedAt: r.created_at,
    updatedAt: r.updated_at,
    requester: { name: r.contact_name, email: r.contact_email },
    subject: subjectOf(r),
    body: fields.map((f) => `${f.label}: ${f.value}`).join("\n"),
    fields: r.client_estimate != null ? [...fields, { label: "estimate (参考)", value: `¥${r.client_estimate.toLocaleString("ja-JP")}` }] : fields,
    readState: r.read_at ? "read" : "unread",
    replyState: r.replied_at ? "replied" : "unreplied",
    caseStatus: (CASE.includes(r.status) ? r.status : "new") as CaseStatus,
    scheduledAt: str(a.scheduledAt) || undefined,
    dueDate: str(a.dueDate) || undefined,
    quote: isObj(a.quote) ? (a.quote as Inquiry["quote"]) : undefined,
    payment: isObj(a.payment) ? (a.payment as Inquiry["payment"]) : undefined,
    internalMemo: r.admin_note ?? "",
    billing: {
      region: r.region ?? undefined,
      regionDetected: r.region_detected ?? undefined,
      currency: r.currency ?? undefined,
      paymentMethod: r.payment_method ?? undefined,
      serverQuote: r.server_quote ? (r.server_quote as unknown as ServerQuote) : undefined,
      confirmed: r.confirmed_amount != null && r.confirmed_currency ? { amount: r.confirmed_amount, currency: r.confirmed_currency, at: r.confirmed_at ?? "" } : undefined,
    },
    attachments: [],
    source: "form",
    // 送信時の原文（整理表示と返信文の組み立てに使う）
    raw: { kind: r.kind, locale: r.locale, payload: r.payload, estimate: r.client_estimate, receiptNo: r.receipt_no, receivedAt: r.created_at },
  };
}

type DraftRow = { purpose: string; locale: "ja" | "en"; selected: string[]; inputs: Record<string, string>; subject: string; body: string; updated_at: string };
type ActivityRow = { id: string; submission_id: string; kind: ActivityKind; occurred_at: string | null; recorded_at: string; note: string | null; amount: number | null; data: Record<string, unknown>; important: boolean };

function toTeacher(r: Row): TeacherApplication {
  const pub = isObj(r.payload.public) ? r.payload.public : {};
  const edu = isObj(pub.education) ? pub.education : {};
  const minutes = typeof pub.travelMinutes === "number" ? pub.travelMinutes : undefined;
  const profile: TeacherProfile = {
    displayName: str(pub.displayName),
    nameKana: str(pub.nameKana),
    nameRomaji: str(pub.nameRomaji),
    education: { school: str(edu.school), enrollment: edu.enrollment === "student" ? "student" : "graduate", department: str(edu.department) || undefined, gradYear: str(edu.gradYear) || undefined },
    instruments: Array.isArray(pub.instruments) ? pub.instruments.map(str) : [],
    prefectureCode: str(pub.prefectureCode),
    station: str(pub.station) || undefined,
    travel: { available: minutes != null, minutes },
    formats: (Array.isArray(pub.formats) ? pub.formats.map(str) : []) as TeacherProfile["formats"],
    ageGroup: str(pub.ageGroup) || undefined,
    videoUrls: [],
    externalLinks: Array.isArray(pub.externalLinks) ? pub.externalLinks.map(str) : [],
    intro: { ja: str(pub.intro), en: "" },
  };
  return {
    id: r.id,
    submittedAt: r.created_at,
    updatedAt: r.updated_at,
    // 受付直後（new）は「申請済み」として扱う
    status: (TEACHER.includes(r.status) ? r.status : "submitted") as TeacherApplicationStatus,
    profile,
    private: { legalName: r.contact_name, email: r.contact_email, verification: "not_requested", reviewerNote: r.admin_note ?? "" },
    source: "form",
  };
}

const notConnected = () => Promise.reject(new SupabaseError(501, "not_connected"));

async function update(id: string, patch: Obj, note?: string): Promise<Row> {
  return rest<Row>("rpc/admin_update_submission", { method: "POST", body: { p_id: id, p_patch: patch, p_note: note ?? null } });
}

export function createSupabaseRepository(): AdminRepository {
  const select = "select=*";
  return {
    kind: "server",

    async listInquiries() {
      const rows = await rest<Row[]>(`submissions?${select}&kind=neq.teacher_application&status=neq.spam&order=created_at.desc&limit=500`);
      return rows.map(toInquiry);
    },
    async getInquiry(id) {
      const rows = await rest<Row[]>(`submissions?${select}&id=eq.${encodeURIComponent(id)}&limit=1`);
      return rows[0] ? toInquiry(rows[0]) : null;
    },
    async updateInquiry(id, patch: InquiryPatch, note) {
      const p: Obj = {};
      if (patch.caseStatus) p.status = patch.caseStatus;
      if (patch.readState) p.read = patch.readState === "read";
      if (patch.replyState) p.replied = patch.replyState === "replied";
      if (patch.internalMemo !== undefined) p.admin_note = patch.internalMemo;
      const adminData: Obj = {};
      for (const k of ["scheduledAt", "dueDate", "quote", "payment"] as const) if (k in patch) adminData[k] = patch[k] ?? null;
      if (Object.keys(adminData).length) p.admin_data = adminData;
      return toInquiry(await update(id, p, note));
    },
    listMessages: async () => [] as InquiryMessage[],
    saveDraft: notConnected,
    // 返信メールの送信は未接続。送ったことにはしない
    async sendReply(inquiryId, draft) {
      return { id: `not-connected-${Date.now()}`, inquiryId, direction: "outbound", status: "not_connected", createdAt: new Date().toISOString(), ...draft };
    },
    async listStatusHistory(inquiryId) {
      const rows = await rest<EventRow[]>(`submission_events?select=*&submission_id=eq.${encodeURIComponent(inquiryId)}&order=changed_at.asc`);
      return rows.map(
        (e): InquiryStatusHistory => ({ id: e.id, inquiryId: e.submission_id, from: (e.from_status as CaseStatus | null) ?? null, to: e.to_status as CaseStatus, note: e.note ?? undefined, changedAt: e.changed_at, changedBy: e.changed_by ?? "" }),
      );
    },
    async getReplyDraft(id) {
      const rows = await rest<DraftRow[]>(`reply_drafts?select=*&submission_id=eq.${encodeURIComponent(id)}&limit=1`);
      const d = rows[0];
      return d ? ({ purpose: d.purpose, locale: d.locale, selected: d.selected, inputs: d.inputs ?? {}, subject: d.subject, body: d.body, updatedAt: d.updated_at } satisfies ReplyDraft) : null;
    },
    async saveReplyDraft(id, d) {
      await rest("rpc/admin_save_reply_draft", { method: "POST", body: { p_submission: id, p_purpose: d.purpose, p_locale: d.locale, p_selected: d.selected, p_inputs: d.inputs, p_subject: d.subject, p_body: d.body } });
    },
    async addActivity(id, a) {
      await rest("rpc/admin_add_activity", {
        method: "POST",
        body: { p_submission: id, p_kind: a.kind, p_request_id: a.requestId, p_note: a.note ?? null, p_amount: a.amount ?? null, p_occurred_at: a.occurredAt ?? null, p_data: a.data ?? {} },
      });
    },
    async listActivities(id) {
      const rows = await rest<ActivityRow[]>(`case_activities?select=*&submission_id=eq.${encodeURIComponent(id)}&order=recorded_at.asc`);
      return rows.map(
        (x): CaseActivity => ({ id: x.id, inquiryId: x.submission_id, kind: x.kind, occurredAt: x.occurred_at ?? undefined, recordedAt: x.recorded_at, note: x.note ?? undefined, amount: x.amount ?? undefined, data: x.data ?? {}, important: x.important }),
      );
    },
    async hideInquiry(id) {
      await update(id, { status: "spam" }, "迷惑な送信として非表示");
    },
    async deleteInquiry(id) {
      await rest<string>("rpc/admin_delete_submission", { method: "POST", body: { p_id: id } });
    },
    listTemplates: async () => [],

    // ── 料金・決済 ──
    async listPrices() {
      const rows = await rest<PriceRowDb[]>("price_items?select=*&order=service.asc,item.asc,effective_from.desc");
      return rows.map(toPrice);
    },
    async addPrice(p) {
      const row = await rest<PriceRowDb>("rpc/admin_add_price", {
        method: "POST",
        body: { p_service: p.service, p_item: p.item, p_mode: p.mode, p_jpy: p.jpy, p_usd_cents: p.usdCents, p_effective_from: p.effectiveFrom, p_active: p.active, p_note: p.note ?? null },
      });
      return toPrice(row);
    },
    async confirmPrice(id, amount, currency, note) {
      return toInquiry(await rest<Row>("rpc/admin_confirm_price", { method: "POST", body: { p_id: id, p_amount: amount, p_currency: currency, p_note: note ?? null } }));
    },
    async listPayments(id) {
      const rows = await rest<PaymentRowDb[]>(`payments?select=*&submission_id=eq.${encodeURIComponent(id)}&order=created_at.asc`);
      return rows.map(toPayment);
    },

    async listTeacherApplications() {
      const rows = await rest<Row[]>(`submissions?${select}&kind=eq.teacher_application&status=neq.spam&order=created_at.desc&limit=500`);
      return rows.map(toTeacher);
    },
    async setTeacherStatus(id, status, note) {
      const p: Obj = { status };
      if (note) p.admin_note = note;
      return toTeacher(await update(id, p, note));
    },

    // ── 未接続の機能（空のデータ） ──
    listRevenue: async () => [],
    listAnalytics: async () => [],
    trafficBreakdown: async () => [],
    scoreDownloads: async () => [],
    formFunnel: async () => [],
    listCalendarEvents: async () => [],
    listNotifications: async () => [],
    getNotificationSettings: async () => ({ email: "", settings: [] }),
    saveNotificationSettings: notConnected,
    getPdfPolicy: async (): Promise<PdfAccessPolicy> => ({
      mode: "open",
      perClientPerMinute: 0,
      perClientPerDay: 0,
      burstThreshold: 0,
      blockKnownAiCrawlers: false,
      signedUrlTtlSeconds: 0,
      notifyOnSuspicious: false,
      updatedAt: "",
    }),
    savePdfPolicy: notConnected,
    listPdfEvents: async () => [],
    listSuspiciousClients: async () => [],
    setClientState: notConnected,
    listPdfGrants: async () => [],
    saveGrant: notConnected,
    revokeGrant: notConnected,
    listAuditLog: async () => [],
    getAdReport: async () => ({ launchDate: null, daily: [], byUnit: [], byPage: [] }),
    siteDaily: async () => [],
    getAdSettings: async (): Promise<AdSettings> => ({
      adsenseEnabled: false,
      publisherId: "",
      pages: { work: false, composer: false, category: false },
      units: [],
      amazonEnabled: false,
      googleManaged: { autoAds: false, vignette: false, anchor: false, cmpConfigured: false, adsTxt: "missing" },
      updatedAt: "",
    }),
    saveAdSettings: notConnected,
  };
}
