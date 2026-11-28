// デモ用のリポジトリ（ブラウザのメモリ内だけで動く。再読み込みで元に戻る）。
// メール送信・外部サービスへの接続は一切しない。返信は status: "not_connected" で記録する

import type { AdminRepository, InquiryPatch } from "../repository";
import type { CaseActivity, InquiryMessage, PaymentRecord, PdfAccessGrant, PdfAccessPolicy, PriceItem, ReplyDraft, SuspiciousClient, TeacherApplicationStatus } from "../types";
import { computeQuote, SEED_PRICES } from "../../lib/orders/priceEngine";
import { createDemoData, isoDateTime, type DemoDataset } from "./demoData";

const wait = <T,>(v: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(v)), 120));

export function createDemoRepository(today: Date = new Date()): AdminRepository {
  const db: DemoDataset = createDemoData(today);
  let seq = 1000;
  const nextId = (p: string) => `${p}-${++seq}`;
  const now = () => isoDateTime(new Date());
  const drafts = new Map<string, ReplyDraft>();
  const activities: CaseActivity[] = [];
  // 料金マスタ（初期値）と決済の記録（デモ）
  const prices: PriceItem[] = SEED_PRICES.map((r, i) => ({ id: `demo-price-${i}`, service: r.service, item: r.item, mode: r.mode, jpy: r.jpy, usdCents: r.usd_cents, effectiveFrom: r.effective_from, active: r.active, createdAt: isoDateTime(today) }));
  const payments: PaymentRecord[] = [];
  const seenRequests = new Set<string>();
  const paidTotal = (inquiryId: string, currency: string) =>
    payments.filter((p) => p.inquiryId === inquiryId && p.currency === currency && p.purpose === "initial" && ["paid", "overpaid", "partially_refunded"].includes(p.status)).reduce((n, p) => n + (p.receivedAmount ?? p.amount) - p.refundedAmount, 0);
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

  // 料金・決済の表示を試せるよう、運指・運弓と録音の案件に請求先と受付時の計算を付ける（デモ）
  const day = isoDateTime(today).slice(0, 10);
  const bow = db.inquiries.find((i) => i.kind === "bowing");
  if (bow) {
    const q = computeQuote({ service: "bowing", type: "both", pages: 5, delivery: "twoDays" }, SEED_PRICES, "intl", day);
    // 端末の推定（日本以外）とアクセス元の国（日本）が違う例
    bow.billing = { region: "jp", regionDetected: "JP", regionGuess: "intl", currency: "USD", paymentMethod: "card", serverQuote: q.ok ? q : undefined };
  }
  const rec = db.inquiries.find((i) => i.kind === "recording");
  if (rec) {
    const q = computeQuote({ service: "recording", tracks: { violin: 2, cello: 1 }, delivery: "threePlus" }, SEED_PRICES, "jp", day);
    rec.billing = { region: "jp", currency: "JPY", paymentMethod: "bank_transfer", serverQuote: q.ok ? q : undefined };
  }

  return {
    kind: "demo",

    listPrices: () => wait([...prices].sort((a, b) => a.service.localeCompare(b.service) || a.item.localeCompare(b.item) || b.effectiveFrom.localeCompare(a.effectiveFrom))),
    async addPrice(p) {
      const todayStr = isoDateTime(new Date()).slice(0, 10);
      if (p.effectiveFrom < todayStr) throw new Error("past_effective_date");
      const same = prices.find((x) => x.service === p.service && x.item === p.item && x.effectiveFrom === p.effectiveFrom);
      if (same && same.effectiveFrom <= todayStr) throw new Error("effective_today_locked");
      const row: PriceItem = { ...p, id: same?.id ?? nextId("demo-price"), createdAt: now() };
      if (same) Object.assign(same, row);
      else prices.push(row);
      return wait(row);
    },
    async confirmPrice(id, amount, currency, note) {
      const inq = db.inquiries.find((i) => i.id === id);
      if (!inq) throw new Error("not_found");
      if (payments.some((p) => p.inquiryId === id && p.purpose === "initial" && ["paid", "underpaid", "overpaid", "partially_refunded", "refunded", "disputed"].includes(p.status))) throw new Error("already_paid");
      for (const p of payments) if (p.inquiryId === id && p.purpose === "initial" && ["pending", "link_sent"].includes(p.status) && (p.amount !== amount || p.currency !== currency)) p.status = "cancelled";
      const previous = inq.billing?.confirmed?.amount;
      // データベースと同じ: 確定した通貨で料金区分を直し、日本以外は銀行振込からカードに戻す
      const b0 = inq.billing ?? {};
      inq.billing = { ...b0, region: currency === "JPY" ? "jp" : "intl", currency, paymentMethod: currency === "USD" && b0.paymentMethod === "bank_transfer" ? "card" : b0.paymentMethod, confirmed: { amount, currency, at: now() } };
      activities.push({ id: nextId("demo-act"), inquiryId: id, kind: previous == null ? "quote_sent" : "quote_changed", recordedAt: now(), note, amount, data: { currency, previous }, important: true });
      return wait(inq);
    },
    listPayments: (id) => wait(payments.filter((p) => p.inquiryId === id)),
    // デモにはファイルの保存先が無い
    attachmentUrl: async () => null,
    // 銀行振込（データベースの関数と同じ規則。再送の判定は requestId）
    async recordBankNotice(id, requestId, note) {
      const inq = db.inquiries.find((i) => i.id === id);
      if (!inq) throw new Error("not_found");
      const c = inq.billing?.confirmed;
      if (!c) throw new Error("amount_not_confirmed");
      if (c.currency !== "JPY") throw new Error("bank_transfer_jp_only");
      if (payments.some((p) => p.inquiryId === id && p.purpose === "initial" && ["paid", "overpaid", "partially_refunded", "disputed"].includes(p.status))) throw new Error("already_paid");
      const seen = seenRequests.has(requestId);
      seenRequests.add(requestId);
      let pay = payments.find((p) => p.inquiryId === id && p.method === "bank_transfer" && p.purpose === "initial" && ["pending", "link_sent", "underpaid"].includes(p.status) && p.amount === c.amount);
      if (seen && pay) return wait(pay);
      if (pay) {
        if (pay.status !== "underpaid") pay.status = "link_sent";
        pay.notifiedAt = now();
      } else {
        pay = { id: nextId("demo-pay"), inquiryId: id, purpose: "initial", method: "bank_transfer", currency: "JPY", amount: c.amount, status: "link_sent", refundedAmount: 0, notifiedAt: now(), note, createdAt: now() };
        payments.push(pay);
      }
      activities.push({ id: nextId("demo-act"), inquiryId: id, kind: "invoiced", recordedAt: now(), note, amount: c.amount, data: { method: "bank_transfer" }, important: true });
      inq.billing = { ...(inq.billing ?? {}), paymentMethod: "bank_transfer" };
      if (["new", "scheduling", "quoted"].includes(inq.caseStatus)) inq.caseStatus = "awaiting_payment";
      return wait(pay);
    },
    async recordBankReceipt(paymentId, amount, receivedOn, requestId, note) {
      const pay = payments.find((p) => p.id === paymentId);
      if (!pay) throw new Error("not_found");
      if (pay.method !== "bank_transfer") throw new Error("not_bank_transfer");
      if (!(amount >= 1)) throw new Error("invalid_amount");
      if (receivedOn > now().slice(0, 10)) throw new Error("invalid_date");
      if (seenRequests.has(requestId)) return wait(pay);
      seenRequests.add(requestId);
      const total = (pay.receivedAmount ?? 0) + amount;
      pay.receivedAmount = total;
      pay.status = total === pay.amount ? "paid" : total < pay.amount ? "underpaid" : "overpaid";
      pay.paidAt = `${receivedOn}T00:00:00+09:00`;
      if (note) pay.note = [pay.note, note].filter(Boolean).join(" / ");
      activities.push({ id: nextId("demo-act"), inquiryId: pay.inquiryId, kind: "paid", occurredAt: pay.paidAt, recordedAt: now(), note, amount, data: { method: "bank_transfer" }, important: true });
      const inq = db.inquiries.find((i) => i.id === pay.inquiryId);
      if (inq && (pay.status === "paid" || pay.status === "overpaid") && ["new", "scheduling", "quoted", "awaiting_payment"].includes(inq.caseStatus)) inq.caseStatus = "paid";
      return wait(pay);
    },
    async recordBankRefund(paymentId, amount, requestId, note) {
      const pay = payments.find((p) => p.id === paymentId);
      if (!pay) throw new Error("not_found");
      const received = pay.receivedAmount ?? 0;
      if (!(amount >= 1) || pay.refundedAmount + amount > received) throw new Error("invalid_amount");
      if (seenRequests.has(requestId)) return wait(pay);
      seenRequests.add(requestId);
      pay.refundedAmount += amount;
      const left = received - pay.refundedAmount;
      pay.status = left <= 0 ? "refunded" : pay.status === "overpaid" && left === pay.amount ? "paid" : pay.status === "overpaid" && left > pay.amount ? "overpaid" : "partially_refunded";
      activities.push({ id: nextId("demo-act"), inquiryId: pay.inquiryId, kind: "refunded", recordedAt: now(), note, amount, data: { method: "bank_transfer" }, important: true });
      return wait(pay);
    },
    async cancelPayment(paymentId, note) {
      const pay = payments.find((p) => p.id === paymentId);
      if (!pay || !["pending", "link_sent"].includes(pay.status)) throw new Error("invalid_state");
      pay.status = "cancelled";
      if (note) pay.note = [pay.note, note].filter(Boolean).join(" / ");
      return wait(pay);
    },

    listInquiries: () => wait([...db.inquiries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))),
    getInquiry: (id) => wait(db.inquiries.find((i) => i.id === id) ?? null),
    async updateInquiry(id, patch: InquiryPatch, note) {
      const inq = db.inquiries.find((i) => i.id === id);
      if (!inq) throw new Error("not_found");
      // データベースと同じ制約: 確定金額がある案件は、入金確認前に「入金済み」「対応中」にできない
      const c = inq.billing?.confirmed;
      if (patch.caseStatus && patch.caseStatus !== inq.caseStatus && (patch.caseStatus === "paid" || patch.caseStatus === "in_progress") && c && paidTotal(id, c.currency) < c.amount) {
        throw new Error("payment_required");
      }
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
