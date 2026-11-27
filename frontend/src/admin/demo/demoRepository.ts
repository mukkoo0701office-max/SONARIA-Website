// デモ用のリポジトリ（ブラウザのメモリ内だけで動く。再読み込みで元に戻る）。
// メール送信・外部サービスへの接続は一切しない。返信は status: "not_connected" で記録する

import type { AdminRepository, InquiryPatch } from "../repository";
import type { InquiryMessage, PdfAccessGrant, PdfAccessPolicy, SuspiciousClient, TeacherApplicationStatus } from "../types";
import { createDemoData, isoDateTime, type DemoDataset } from "./demoData";

const wait = <T,>(v: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(v)), 120));

export function createDemoRepository(today: Date = new Date()): AdminRepository {
  const db: DemoDataset = createDemoData(today);
  let seq = 1000;
  const nextId = (p: string) => `${p}-${++seq}`;
  const now = () => isoDateTime(new Date());

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
