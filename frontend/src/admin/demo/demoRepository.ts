// デモ用のリポジトリ（ブラウザのメモリ内だけで動く。再読み込みで元に戻る）。
// メール送信・外部サービスへの接続は一切しない。返信は status: "not_connected" で記録する

import type { AdminRepository, InquiryPatch } from "../repository";
import type { CaseActivity, InquiryMessage, PdfAccessGrant, PdfAccessPolicy, ReplyDraft, SuspiciousClient, TeacherApplicationStatus } from "../types";
import { createDemoData, isoDateTime, type DemoDataset } from "./demoData";

const wait = <T,>(v: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(v)), 120));

export function createDemoRepository(today: Date = new Date()): AdminRepository {
  const db: DemoDataset = createDemoData(today);
  let seq = 1000;
  const nextId = (p: string) => `${p}-${++seq}`;
  const now = () => isoDateTime(new Date());
  const drafts = new Map<string, ReplyDraft>();
  const activities: CaseActivity[] = [];
  // 返信文の組み立てを試せるよう、1 件目（演奏依頼）に送信時の原文を付ける（デモ）
  const first = db.inquiries.find((i) => i.id === "demo-inq-1");
  if (first) {
    const d = (n: number) => isoDateTime(new Date(today.getTime() + n * 86400000)).slice(0, 10);
    first.raw = {
      kind: "performance_quote",
      locale: "ja",
      receiptNo: first.receiptNo,
      receivedAt: first.receivedAt,
      estimate: null,
      payload: {
        kind: "performance_quote",
        locale: "ja",
        schedule: { mode: "candidates", dates: [{ date: d(48), slot: "afternoon", time: "" }, { date: d(55), slot: "afternoon", time: "" }], period: "" },
        budget: "100to200k",
        ensemble: "quartet",
        instruments: "",
        remarks: "ホテルの宴会場で、歓談中に30分ほど。（デモデータ）",
        contact: { name: first.requester.name, email: first.requester.email },
        consent: true,
      },
    };
  }

  return {
    kind: "demo",

    listInquiries: () => wait([...db.inquiries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))),
    getInquiry: (id) => wait(db.inquiries.find((i) => i.id === id) ?? null),
    async updateInquiry(id, patch: InquiryPatch, note) {
      const inq = db.inquiries.find((i) => i.id === id);
      if (!inq) throw new Error("not_found");
      if (patch.caseStatus && patch.caseStatus !== inq.caseStatus) {
        db.statusHistory.push({ id: nextId("demo-h"), inquiryId: id, from: inq.caseStatus, to: patch.caseStatus, note, changedAt: now(), changedBy: "demo-admin" });
        db.auditLog.unshift({ id: nextId("demo-a"), at: now(), actor: "demo-admin", action: "inquiry.status_changed", target: id, detail: `${inq.caseStatus} → ${patch.caseStatus}` });
      }
      Object.assign(inq, patch, { updatedAt: now() });
      return wait(inq);
    },
    listMessages: (inquiryId) => wait(db.messages.filter((m) => m.inquiryId === inquiryId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
    async saveDraft(inquiryId, draft) {
      const existing = db.messages.find((m) => m.inquiryId === inquiryId && m.status === "draft");
      if (existing) Object.assign(existing, draft, { createdAt: now() });
      const msg: InquiryMessage = existing ?? { id: nextId("demo-msg"), inquiryId, direction: "outbound", status: "draft", createdAt: now(), ...draft };
      if (!existing) db.messages.push(msg);
      return wait(msg);
    },
    async sendReply(inquiryId, draft) {
      // 送信サービス未接続: 送ったことにはしない（履歴に「未接続」として残す）
      db.messages = db.messages.filter((m) => !(m.inquiryId === inquiryId && m.status === "draft"));
      const msg: InquiryMessage = { id: nextId("demo-msg"), inquiryId, direction: "outbound", status: "not_connected", createdAt: now(), ...draft };
      db.messages.push(msg);
      return wait(msg);
    },
    listStatusHistory: (inquiryId) => wait(db.statusHistory.filter((h) => h.inquiryId === inquiryId)),
    getReplyDraft: (id) => wait(drafts.get(id) ?? null),
    async saveReplyDraft(id, draft) {
      drafts.set(id, { ...draft, updatedAt: now() });
      await wait(null);
    },
    async addActivity(id, a) {
      if (activities.some((x) => x.data.requestId === a.requestId)) return;
      const important = ["quote_sent", "quote_changed", "booked", "invoiced", "paid", "refunded", "completed", "cancelled"].includes(a.kind);
      activities.push({ id: nextId("demo-act"), inquiryId: id, kind: a.kind, occurredAt: a.occurredAt, recordedAt: now(), note: a.note, amount: a.amount, data: { ...a.data, requestId: a.requestId }, important });
      const inq = db.inquiries.find((i) => i.id === id);
      if (inq && ["reply_sent", "email", "line", "phone"].includes(a.kind)) inq.replyState = "replied";
      if (a.kind === "reply_sent") drafts.delete(id);
      await wait(null);
    },
    listActivities: (id) => wait(activities.filter((x) => x.inquiryId === id)),
    async hideInquiry(id) {
      db.inquiries = db.inquiries.filter((i) => i.id !== id);
      await wait(null);
    },
    async deleteInquiry(id) {
      db.inquiries = db.inquiries.filter((i) => i.id !== id);
      db.statusHistory = db.statusHistory.filter((h) => h.inquiryId !== id);
      db.messages = db.messages.filter((m) => m.inquiryId !== id);
      await wait(null);
    },
    listTemplates: () => wait(db.templates),

    listTeacherApplications: () => wait([...db.teacherApplications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))),
    async setTeacherStatus(id, status: TeacherApplicationStatus, note) {
      const app = db.teacherApplications.find((a) => a.id === id);
      if (!app) throw new Error("not_found");
      db.auditLog.unshift({ id: nextId("demo-a"), at: now(), actor: "demo-admin", action: `teacher.${status}`, target: id, detail: note });
      app.status = status;
      app.updatedAt = now();
      if (note) app.private.reviewerNote = note;
      return wait(app);
    },

    listRevenue: () => wait(db.revenue),

    listAnalytics: (fromISO, toISO) => wait(db.analytics.filter((m) => m.date >= fromISO && m.date <= toISO)),
    trafficBreakdown: (kind) => wait(kind === "referrer" ? db.referrers : kind === "device" ? db.devices : db.countries),
    scoreDownloads: () => wait(db.scoreDownloads),
    formFunnel: () => wait(db.formFunnel),

    listCalendarEvents: () => wait(db.calendar),

    listNotifications: () => wait([...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    getNotificationSettings: () => wait({ email: "", settings: db.notificationSettings }),
    async saveNotificationSettings(settings) {
      db.notificationSettings = settings;
      await wait(null);
    },

    getPdfPolicy: () => wait(db.pdfPolicy),
    async savePdfPolicy(policy: PdfAccessPolicy) {
      db.auditLog.unshift({ id: nextId("demo-a"), at: now(), actor: "demo-admin", action: "pdf.policy_changed", detail: `mode: ${db.pdfPolicy.mode} → ${policy.mode}` });
      db.pdfPolicy = { ...policy, updatedAt: now() };
      return wait(db.pdfPolicy);
    },
    listPdfEvents: () => wait(db.pdfEvents),
    listSuspiciousClients: () => wait(db.suspicious),
    async setClientState(clientHash, state: SuspiciousClient["state"]) {
      const c = db.suspicious.find((s) => s.clientHash === clientHash);
      if (c) c.state = state;
      await wait(null);
    },
    listPdfGrants: () => wait(db.pdfGrants),
    async saveGrant(grant) {
      const g: PdfAccessGrant = { ...grant, id: nextId("demo-g"), createdAt: now(), status: "active" };
      db.pdfGrants.unshift(g);
      return wait(g);
    },
    async revokeGrant(id) {
      const g = db.pdfGrants.find((x) => x.id === id);
      if (g) g.status = "revoked";
      await wait(null);
    },

    listAuditLog: () => wait(db.auditLog),

    async getAdReport(fromISO, toISO) {
      const daily = db.adDaily.filter((d) => d.date >= fromISO && d.date <= toISO);
      const sum = (f: (d: (typeof daily)[number]) => number) => daily.reduce((a, d) => a + f(d), 0);
      const total = { e: sum((d) => d.estimatedEarnings), i: sum((d) => d.impressions), p: sum((d) => d.adsensePageviews) };
      // ページ別は作品ページの PV の比率で按分（デモ用の作り方）
      const weights = [0.42, 0.33, 0.25];
      const byPage = db.adPages.map((path, k) => ({
        key: path,
        label: path,
        estimatedEarnings: Math.round(total.e * weights[k]),
        impressions: Math.round(total.i * weights[k]),
        adsensePageviews: Math.round(total.p * weights[k]),
      }));
      return wait({ launchDate: db.adLaunchDate, daily, byUnit: [{ key: "work-after-downloads", label: "work-after-downloads", estimatedEarnings: total.e, impressions: total.i, adsensePageviews: total.p }], byPage });
    },
    siteDaily: (fromISO, toISO) => wait(db.siteDaily.filter((d) => d.date >= fromISO && d.date <= toISO)),
    getAdSettings: () => wait(db.adSettings),
    async saveAdSettings(settings) {
      db.auditLog.unshift({ id: nextId("demo-a"), at: now(), actor: "demo-admin", action: "ads.settings_changed", detail: `adsense: ${settings.adsenseEnabled ? "on" : "off"}, amazon: ${settings.amazonEnabled ? "on" : "off"}` });
      db.adSettings = { ...settings, updatedAt: now() };
      return wait(db.adSettings);
    },
  };
}
