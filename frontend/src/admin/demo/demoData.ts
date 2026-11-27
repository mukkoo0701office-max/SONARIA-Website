// 表示確認用の架空データ（デモ）。実在の人物・案件・売上ではない。
// - 管理画面のプレビュー用ビルド（SONARIA_ADMIN_PREVIEW=1）にだけ含まれる。本番・Pages のビルドには入らない（CI で検査）
// - 名前には「（デモ）」を付け、画面上部にもデモである旨を常に表示する
// - 日付は「今日」を基準に作る（カレンダーや期限の表示を確認できるように）
// - 通知先のメールアドレスはコードに書かない（サーバーの環境変数 ADMIN_NOTIFY_EMAIL で指定する。docs/admin/ADMIN_SYSTEM_DESIGN.md）

import type {
  AnalyticsMetric,
  AuditLog,
  CalendarEvent,
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
} from "../types";

/** 本番ビルドに混入していないかを CI が探す目印（この文字列が out/ にあれば失敗） */
export const DEMO_MARKER = "SONARIA_ADMIN_DEMO_DATA";

/** 通知メールの宛先の表示（実際の宛先はサーバー側の設定） */
export const NOTIFY_TO = "ADMIN_NOTIFY_EMAIL";

// 再現できる疑似乱数（毎回同じデモになる）
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function isoDateTime(d: Date): string {
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
}
function addDays(base: Date, days: number, hour = 10, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export type DemoDataset = ReturnType<typeof createDemoData>;

export function createDemoData(today: Date = new Date()) {
  const r = rng(20261127);
  const T = (days: number, h = 10, m = 0) => isoDateTime(addDays(today, days, h, m));
  const D = (days: number) => isoDate(addDays(today, days));
  const ymd = isoDate(today).replaceAll("-", "");

  // ── 問い合わせ ──
  const base: Omit<Inquiry, "id" | "receiptNo" | "updatedAt" | "source" | "attachments" | "internalMemo" | "body">[] = [
    {
      kind: "performance",
      receivedAt: T(0, 9, 12),
      requester: { name: "佐藤 花子（デモ）", email: "demo-1@example.com" },
      subject: "結婚披露宴での弦楽四重奏",
      fields: [
        { label: "日程", value: `候補が複数ある\n${D(48)} 午後\n${D(55)} 午後` },
        { label: "予算範囲", value: "10万〜20万円" },
        { label: "編成", value: "弦楽四重奏" },
        { label: "備考", value: "ホテルの宴会場で、歓談中に30分ほど。（デモデータ）" },
      ],
      readState: "unread",
      replyState: "unreplied",
      caseStatus: "new",
    },
    {
      kind: "recording",
      receivedAt: T(-1, 21, 40),
      requester: { name: "Demo Studio（デモ）", email: "demo-2@example.com" },
      subject: "ポップスのストリングス 3 曲",
      fields: [
        { label: "曲数", value: "3 曲" },
        { label: "納期", value: D(12) },
        { label: "備考", value: "ヴァイオリン 2 本の重ね録り希望。（デモデータ）" },
      ],
      readState: "read",
      replyState: "unreplied",
      caseStatus: "quoted",
      dueDate: D(12),
      quote: { amount: 66000, currency: "JPY", issuedAt: T(-1, 23) },
    },
    {
      kind: "lesson",
      receivedAt: T(-2, 18, 5),
      requester: { name: "田中 一郎（デモ）", email: "demo-3@example.com" },
      subject: "大人の初心者レッスン（体験）",
      fields: [
        { label: "コース", value: "体験レッスン" },
        { label: "希望日時", value: `${D(3)} 19:00` },
      ],
      readState: "read",
      replyState: "replied",
      caseStatus: "booked",
      scheduledAt: T(3, 19),
      booking: { startsAt: T(3, 19), endsAt: T(3, 20), place: "オンライン" },
      payment: { status: "unbilled", amount: 1000 },
    },
    {
      kind: "teacher",
      receivedAt: T(-2, 11, 30),
      requester: { name: "山本 さくら（デモ）", email: "demo-4@example.com" },
      subject: "講師登録の申請",
      fields: [{ label: "楽器", value: "チェロ" }],
      readState: "unread",
      replyState: "unreplied",
      caseStatus: "new",
    },
    {
      kind: "bowing",
      receivedAt: T(-4, 8, 50),
      requester: { name: "市民オーケストラ（デモ）", email: "demo-5@example.com" },
      subject: "運指・運弓の書き込み（交響曲 1 曲）",
      fields: [
        { label: "楽器", value: "ヴァイオリン 1st・2nd" },
        { label: "納期", value: D(2) },
      ],
      readState: "read",
      replyState: "replied",
      caseStatus: "in_progress",
      dueDate: D(2),
      quote: { amount: 22000, confirmedAmount: 22000, currency: "JPY", issuedAt: T(-4, 12), confirmedAt: T(-3, 9) },
      payment: { status: "billed", dueDate: D(5), amount: 22000 },
    },
    {
      kind: "general",
      receivedAt: T(-5, 14, 0),
      requester: { name: "Demo User（デモ）", email: "demo-6@example.com" },
      subject: "楽譜の誤りの報告",
      fields: [{ label: "作品", value: "ハイドン 弦楽四重奏曲 Op.76-3" }],
      readState: "read",
      replyState: "unreplied",
      caseStatus: "new",
    },
    {
      kind: "performance",
      receivedAt: T(-9, 10, 0),
      requester: { name: "株式会社サンプル（デモ）", email: "demo-7@example.com" },
      subject: "企業パーティーでのデュオ演奏",
      fields: [
        { label: "日程", value: `決まっている\n${D(6)} 夜` },
        { label: "予算範囲", value: "5万〜10万円" },
        { label: "編成", value: "デュオ" },
      ],
      readState: "read",
      replyState: "replied",
      caseStatus: "booked",
      scheduledAt: T(6, 18, 30),
      booking: { startsAt: T(6, 18, 30), endsAt: T(6, 20), place: "都内ホテル（デモ）" },
      quote: { amount: 88000, confirmedAmount: 80000, currency: "JPY", issuedAt: T(-8), confirmedAt: T(-6) },
      payment: { status: "overdue", dueDate: D(-1), amount: 80000 },
    },
    {
      kind: "recording",
      receivedAt: T(-20, 16, 0),
      requester: { name: "Demo Composer（デモ）", email: "demo-8@example.com" },
      subject: "ゲーム BGM のソロ録音",
      fields: [{ label: "曲数", value: "2 曲" }],
      readState: "read",
      replyState: "replied",
      caseStatus: "completed",
      quote: { amount: 44000, confirmedAmount: 44000, currency: "JPY", confirmedAt: T(-18) },
      payment: { status: "paid", paidAt: T(-8), amount: 44000, fee: 1584 },
    },
    {
      kind: "lesson",
      receivedAt: T(-12, 20, 0),
      requester: { name: "高橋 美咲（デモ）", email: "demo-9@example.com" },
      subject: "子どものレッスン（月 2 回）",
      fields: [{ label: "コース", value: "集中プラン" }],
      readState: "read",
      replyState: "replied",
      caseStatus: "cancelled",
    },
  ];
  const inquiries: Inquiry[] = base.map((b, i) => ({
    ...b,
    id: `demo-inq-${i + 1}`,
    receiptNo: `SNR-${ymd}-${String(i + 1).padStart(4, "0")}`,
    updatedAt: b.receivedAt,
    body: b.fields.map((f) => `${f.label}: ${f.value}`).join("\n"),
    internalMemo: i === 1 ? "見積もり送付済み。返事待ち（デモ）" : "",
    attachments: i === 1 ? [{ name: "reference-demo.mp3", size: 4_200_000 }] : [],
    source: "demo",
  }));

  const messages: InquiryMessage[] = [
    {
      id: "demo-msg-1",
      inquiryId: "demo-inq-3",
      direction: "outbound",
      status: "not_connected",
      subject: "体験レッスンのご案内（デモ）",
      body: "田中様\n\nお申し込みありがとうございます。…（デモデータ）",
      createdAt: T(-2, 20),
    },
  ];

  const statusHistory: InquiryStatusHistory[] = [
    { id: "demo-h-1", inquiryId: "demo-inq-7", from: null, to: "new", changedAt: T(-9, 10), changedBy: "demo-admin" },
    { id: "demo-h-2", inquiryId: "demo-inq-7", from: "new", to: "quoted", changedAt: T(-8), changedBy: "demo-admin", note: "88,000 円で提示" },
    { id: "demo-h-3", inquiryId: "demo-inq-7", from: "quoted", to: "booked", changedAt: T(-6), changedBy: "demo-admin", note: "80,000 円で確定" },
  ];

  const templates: ReplyTemplate[] = [
    {
      id: "thanks",
      name: { ja: "受付のお礼", en: "Thank you" },
      subject: { ja: "お問い合わせありがとうございます【SONARIA】", en: "Thank you for your enquiry [SONARIA]" },
      body: {
        ja: "{name} 様\n\nこのたびは SONARIA にお問い合わせいただき、ありがとうございます。\n内容を確認のうえ、あらためてご連絡いたします。\n\nSONARIA",
        en: "Dear {name},\n\nThank you for contacting SONARIA.\nWe will review your enquiry and get back to you shortly.\n\nSONARIA",
      },
    },
    {
      id: "quote",
      name: { ja: "お見積もり", en: "Quote" },
      subject: { ja: "お見積もりのご案内【SONARIA】", en: "Your quote [SONARIA]" },
      body: {
        ja: "{name} 様\n\nお見積もりは {amount} です。\nご検討のほど、よろしくお願いいたします。\n\nSONARIA",
        en: "Dear {name},\n\nOur quote is {amount}.\nPlease let us know if you would like to proceed.\n\nSONARIA",
      },
    },
    {
      id: "schedule",
      name: { ja: "日程の調整", en: "Scheduling" },
      subject: { ja: "日程のご相談【SONARIA】", en: "Scheduling [SONARIA]" },
      body: {
        ja: "{name} 様\n\nご希望の日程について、以下の候補でいかがでしょうか。\n\nSONARIA",
        en: "Dear {name},\n\nWould any of the following dates suit you?\n\nSONARIA",
      },
    },
  ];

  // ── 講師申請 ──
  const teacher = (i: number, status: TeacherApplication["status"], name: string, inst: string[], pref: string, school: string): TeacherApplication => ({
    id: `demo-tch-${i}`,
    submittedAt: T(-i * 3, 11),
    updatedAt: T(-i * 2, 15),
    status,
    profile: {
      displayName: `${name}（デモ）`,
      nameKana: "でも",
      nameRomaji: "Demo",
      education: { school: `${school}（デモ）`, enrollment: i % 2 ? "graduate" : "student", department: "器楽専攻" },
      instruments: inst,
      prefectureCode: pref,
      station: "デモ駅",
      travel: { available: i % 2 === 0, minutes: i % 2 === 0 ? 60 : undefined },
      formats: i % 2 ? ["in_person", "online"] : ["visiting"],
      ageGroup: "20s",
      videoUrls: [],
      externalLinks: ["https://example.com/demo"],
      intro: { ja: "表示確認用の架空の講師です。", en: "A fictional teacher for preview." },
    },
    private: { legalName: `${name}（デモ）`, email: `demo-teacher-${i}@example.com`, verification: i === 2 ? "requested" : "not_requested", reviewerNote: "" },
    source: "demo",
  });
  const teacherApplications: TeacherApplication[] = [
    teacher(1, "submitted", "山本 さくら", ["cello"], "13", "〇〇音楽大学"),
    teacher(2, "under_review", "鈴木 遥", ["violin", "viola"], "14", "△△芸術大学"),
    teacher(3, "changes_requested", "伊藤 大輔", ["piano"], "27", "□□音楽大学"),
    teacher(4, "published", "中村 葵", ["flute"], "23", "〇〇音楽大学"),
    teacher(5, "rejected", "小林 蓮", ["trumpet"], "1", "△△芸術大学"),
  ];

  // ── 収益（過去 13 か月。推定値と確定値を混在） ──
  const revenue: RevenueEntry[] = [];
  const cats: RevenueEntry["category"][] = ["adsense", "amazon", "recording", "performance", "lesson", "donation", "digital", "other"];
  const scales: Record<RevenueEntry["category"], number> = { adsense: 3000, amazon: 1800, recording: 40000, performance: 60000, lesson: 25000, donation: 2000, digital: 4000, other: 1000 };
  for (let m = 12; m >= 0; m--) {
    const month = new Date(today.getFullYear(), today.getMonth() - m, 1);
    for (const c of cats) {
      const n = c === "performance" || c === "recording" ? 1 + Math.floor(r() * 2) : 1;
      for (let k = 0; k < n; k++) {
        const day = 1 + Math.floor(r() * 27);
        const occurred = new Date(month.getFullYear(), month.getMonth(), day);
        if (occurred > today) continue;
        const amount = Math.round((scales[c] * (0.6 + r() * 0.9) * (1 + (12 - m) * 0.04)) / 10) * 10;
        const paid = m > 0 || r() > 0.4;
        revenue.push({
          id: `demo-rev-${revenue.length + 1}`,
          category: c,
          amount,
          currency: "JPY",
          occurredOn: isoDate(occurred),
          billedOn: isoDate(occurred),
          paidOn: paid ? isoDate(addDays(occurred, 14)) : undefined,
          fee: c === "recording" || c === "performance" || c === "lesson" || c === "digital" ? Math.round(amount * 0.036) : 0,
          expense: c === "performance" ? Math.round(amount * 0.15) : c === "recording" ? Math.round(amount * 0.05) : 0,
          refund: c === "digital" && r() > 0.9 ? Math.round(amount * 0.2) : 0,
          paymentStatus: paid ? "paid" : "unpaid",
          source: "demo",
          certainty: (c === "adsense" || c === "amazon") && m === 0 ? "estimated" : "confirmed",
          note: "デモデータ",
        });
      }
    }
  }

  // ── アクセス（過去 90 日） ──
  const pages: { path: string; category: AnalyticsMetric["category"]; weight: number }[] = [
    { path: "/", category: "home", weight: 1 },
    { path: "/scores/", category: "scores", weight: 0.9 },
    { path: "/scores/haydn-string-quartet-op76-3/", category: "work", weight: 0.35 },
    { path: "/scores/beethoven-violin-sonata-5/", category: "work", weight: 0.3 },
    { path: "/scores/bach-double-violin-concerto/", category: "work", weight: 0.25 },
    { path: "/teachers/", category: "teachers", weight: 0.3 },
    { path: "/lessons/", category: "service", weight: 0.22 },
    { path: "/recording/", category: "service", weight: 0.18 },
    { path: "/performance/", category: "form", weight: 0.12 },
    { path: "/bowing/", category: "service", weight: 0.15 },
    { path: "/profile/", category: "other", weight: 0.08 },
  ];
  const analytics: AnalyticsMetric[] = [];
  for (let d = 89; d >= 0; d--) {
    const day = addDays(today, -d);
    const weekday = day.getDay();
    const trend = 1 + (89 - d) * 0.006;
    const weekly = weekday === 0 || weekday === 6 ? 1.25 : 1;
    for (const p of pages) {
      for (const locale of ["ja", "en"] as const) {
        const pv = Math.round(220 * p.weight * trend * weekly * (locale === "ja" ? 1 : 0.18) * (0.75 + r() * 0.5));
        analytics.push({
          date: isoDate(day),
          path: `/${locale}${p.path}`,
          locale,
          category: p.category,
          pageviews: pv,
          visitors: Math.round(pv * (0.55 + r() * 0.15)),
          source: "demo",
        });
      }
    }
  }
  const referrers = [
    { label: "Google", value: 5200 },
    { label: "Direct", value: 2100 },
    { label: "X (Twitter)", value: 640 },
    { label: "YouTube", value: 420 },
    { label: "IMSLP", value: 260 },
    { label: "Other", value: 380 },
  ];
  const devices = [
    { label: "Mobile", value: 6100 },
    { label: "Desktop", value: 2500 },
    { label: "Tablet", value: 400 },
  ];
  const countries = [
    { label: "JP", value: 7600 },
    { label: "US", value: 520 },
    { label: "TW", value: 210 },
    { label: "KR", value: 180 },
    { label: "DE", value: 120 },
    { label: "Other", value: 370 },
  ];
  const scoreDownloads = [
    { workId: "haydn-string-quartet-op76-3", title: "ハイドン 弦楽四重奏曲 Op.76-3「皇帝」", downloads: 412 },
    { workId: "beethoven-violin-sonata-5", title: "ベートーヴェン ヴァイオリン・ソナタ第5番「春」", downloads: 365 },
    { workId: "bach-double-violin-concerto", title: "バッハ 2つのヴァイオリンのための協奏曲", downloads: 298 },
    { workId: "mozart-eine-kleine", title: "モーツァルト アイネ・クライネ・ナハトムジーク", downloads: 254 },
    { workId: "beethoven-string-quartet-1", title: "ベートーヴェン 弦楽四重奏曲第1番", downloads: 171 },
    { workId: "dvorak-american", title: "ドヴォルザーク 弦楽四重奏曲「アメリカ」", downloads: 160 },
    { workId: "elgar-salut-damour", title: "エルガー 愛の挨拶", downloads: 142 },
  ];
  const formFunnel = [
    { kind: "lesson", views: 820, submissions: 31 },
    { kind: "recording", views: 540, submissions: 12 },
    { kind: "performance", views: 410, submissions: 9 },
    { kind: "teacher", views: 260, submissions: 7 },
    { kind: "bowing", views: 330, submissions: 10 },
    { kind: "general", views: 300, submissions: 14 },
  ];

  // ── カレンダー ──
  const calendar: CalendarEvent[] = [
    { id: "demo-cal-1", kind: "lesson", title: "体験レッスン（田中・デモ）", start: T(3, 19), end: T(3, 20), allDay: false, inquiryId: "demo-inq-3", done: false },
    { id: "demo-cal-2", kind: "performance", title: "企業パーティー デュオ（デモ）", start: T(6, 18, 30), end: T(6, 20), allDay: false, inquiryId: "demo-inq-7", done: false },
    { id: "demo-cal-3", kind: "delivery_due", title: "運指・運弓 納品締切（デモ）", start: T(2, 0), allDay: true, inquiryId: "demo-inq-5", done: false },
    { id: "demo-cal-4", kind: "delivery_due", title: "ストリングス 3 曲 納品締切（デモ）", start: T(12, 0), allDay: true, inquiryId: "demo-inq-2", done: false },
    { id: "demo-cal-5", kind: "payment_due", title: "企業パーティー 支払期限（デモ）", start: T(-1, 0), allDay: true, inquiryId: "demo-inq-7", done: false },
    { id: "demo-cal-6", kind: "payment_due", title: "運指・運弓 支払期限（デモ）", start: T(5, 0), allDay: true, inquiryId: "demo-inq-5", done: false },
    { id: "demo-cal-7", kind: "recording", title: "宅録 ストリングス（デモ）", start: T(8, 13), end: T(8, 17), allDay: false, inquiryId: "demo-inq-2", done: false },
    { id: "demo-cal-8", kind: "lesson", title: "レギュラーレッスン（デモ）", start: T(3, 19, 30), end: T(3, 20, 30), allDay: false, done: false },
    { id: "demo-cal-9", kind: "other", title: "楽譜ライブラリ 更新作業（デモ）", start: T(1, 10), end: T(1, 12), allDay: false, done: false },
    { id: "demo-cal-10", kind: "lesson", title: "レッスン（デモ）", start: T(-3, 18), end: T(-3, 19), allDay: false, done: true },
  ];

  // ── 通知 ──
  const notifications: Notification[] = [
    { id: "demo-n-1", kind: "new_inquiry", createdAt: T(0, 9, 12), title: "新しい演奏依頼：佐藤 花子（デモ）", relatedId: "demo-inq-1", channel: "email", to: NOTIFY_TO, delivery: "not_connected", read: false },
    { id: "demo-n-2", kind: "teacher_application", createdAt: T(-2, 11, 30), title: "講師登録の申請：山本 さくら（デモ）", relatedId: "demo-tch-1", channel: "email", to: NOTIFY_TO, delivery: "not_connected", read: false },
    { id: "demo-n-3", kind: "delivery_due", createdAt: T(0, 8), title: "納品締切まで 2 日：運指・運弓（デモ）", relatedId: "demo-inq-5", channel: "dashboard", delivery: "sent", read: false },
    { id: "demo-n-4", kind: "payment_due", createdAt: T(0, 8), title: "支払期限を過ぎています：企業パーティー（デモ）", relatedId: "demo-inq-7", channel: "dashboard", delivery: "sent", read: true },
    { id: "demo-n-5", kind: "suspicious_pdf", createdAt: T(0, 3, 14), title: "短時間に大量の PDF 取得：client 7f3a91（デモ）", channel: "email", to: NOTIFY_TO, delivery: "not_connected", read: false },
    { id: "demo-n-6", kind: "unreplied", createdAt: T(-1, 8), title: "48 時間以上未返信：楽譜の誤りの報告（デモ）", relatedId: "demo-inq-6", channel: "email", to: NOTIFY_TO, delivery: "not_connected", read: true },
    { id: "demo-n-7", kind: "system_error", createdAt: T(-3, 2), title: "フォームの送信先が未設定です（デモ）", channel: "dashboard", delivery: "sent", read: true },
  ];
  const notificationSettings: NotificationSetting[] = (
    ["new_inquiry", "teacher_application", "unreplied", "booking_confirmed", "delivery_due", "payment_due", "system_error", "suspicious_pdf"] as const
  ).map((kind) => ({ kind, email: true, dashboard: true }));

  // ── PDF 保護 ──
  const pdfPolicy: PdfAccessPolicy = {
    mode: "protected",
    perClientPerMinute: 10,
    perClientPerDay: 200,
    burstThreshold: 30,
    blockKnownAiCrawlers: true,
    signedUrlTtlSeconds: 300,
    notifyOnSuspicious: true,
    updatedAt: T(-10),
  };
  const uaFamilies = ["Chrome", "Safari", "Firefox", "Edge", "Mobile Safari"];
  const pdfEvents: PdfDownloadEvent[] = [];
  for (let i = 0; i < 160; i++) {
    const hour = Math.floor(r() * Math.max(1, today.getHours() + 1));
    const w = scoreDownloads[Math.floor(r() * r() * scoreDownloads.length)];
    pdfEvents.push({
      id: `demo-pdf-${i}`,
      at: T(0, hour, Math.floor(r() * 60)),
      assetId: `${w.workId}-part-${1 + Math.floor(r() * 4)}`,
      workId: w.workId,
      clientHash: Math.floor(r() * 0xffffff).toString(16).padStart(6, "0"),
      userAgentFamily: uaFamilies[Math.floor(r() * uaFamilies.length)],
      country: r() > 0.15 ? "JP" : "US",
      outcome: "served",
    });
  }
  const suspicious: SuspiciousClient[] = [
    { clientHash: "7f3a91", userAgentFamily: "python-requests", country: "US", downloadsLastHour: 412, distinctWorks: 188, firstSeen: T(0, 3, 2), lastSeen: T(0, 3, 40), state: "rate_limited", reason: "burst_sequential" },
    { clientHash: "c0de42", userAgentFamily: "GPTBot", country: "US", downloadsLastHour: 96, distinctWorks: 96, firstSeen: T(-1, 22), lastSeen: T(0, 1), state: "blocked", reason: "ai_crawler" },
    { clientHash: "a11ce5", userAgentFamily: "Chrome", country: "JP", downloadsLastHour: 34, distinctWorks: 6, firstSeen: T(0, 10), lastSeen: T(0, 10, 20), state: "watching", reason: "parts_set" },
    { clientHash: "b0b123", userAgentFamily: "curl", country: "DE", downloadsLastHour: 58, distinctWorks: 58, firstSeen: T(0, 5), lastSeen: T(0, 5, 30), state: "watching", reason: "many_works" },
  ];
  const pdfGrants: PdfAccessGrant[] = [
    { id: "demo-g-1", clientName: "〇〇大学 音楽図書室（デモ）", contact: "demo-library@example.org", scope: "all", dailyLimit: 2000, expiresOn: D(90), status: "active", createdAt: T(-30) },
    { id: "demo-g-2", clientName: "市民オーケストラ 譜面係（デモ）", contact: "demo-orch@example.org", scope: "works", workIds: ["beethoven-string-quartet-1"], dailyLimit: 100, expiresOn: D(-2), status: "revoked", createdAt: T(-60) },
  ];

  const auditLog: AuditLog[] = [
    { id: "demo-a-1", at: T(-10), actor: "demo-admin", action: "pdf.policy_changed", detail: "mode: open → protected" },
    { id: "demo-a-2", at: T(-6), actor: "demo-admin", action: "inquiry.status_changed", target: "demo-inq-7", detail: "quoted → booked" },
    { id: "demo-a-3", at: T(-4), actor: "demo-admin", action: "teacher.published", target: "demo-tch-4" },
  ];

  return {
    marker: DEMO_MARKER,
    inquiries,
    messages,
    statusHistory,
    templates,
    teacherApplications,
    revenue,
    analytics,
    referrers,
    devices,
    countries,
    scoreDownloads,
    formFunnel,
    calendar,
    notifications,
    notificationSettings,
    pdfPolicy,
    pdfEvents,
    suspicious,
    pdfGrants,
    auditLog,
  };
}
