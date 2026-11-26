// 申し込みフォームの定義・入力検証・料金計算。
// 画面（Next.js）とサーバー（Edge Function）の両方がこのファイルを使う。
// 画面側の検証・計算は表示用で、サーバー側で必ずやり直す（CLAUDE.md）。
//
// 注意: このファイルは他のファイルを import しない（Deno と Next.js の両方で読めるようにするため）。

export type ServiceId = "lesson" | "bowing";

export const serviceIds: readonly ServiceId[] = ["lesson", "bowing"];

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkboxes"
  | "integer"
  | "datetime"
  | "date"
  | "consent";

export type FieldDef = {
  key: string;
  type: FieldType;
  required?: boolean;
  // 別の項目が特定の値のときだけ必須（例: 出張のときだけ地域が必須）
  requiredIf?: { field: string; equals: string };
  options?: readonly string[];
  maxLength?: number;
  min?: number;
  max?: number;
};

export type StepDef = { key: string; fields: readonly FieldDef[] };

export type FileRule = {
  required: boolean;
  maxFiles: number;
  maxBytes: number;
  // 拡張子と MIME タイプの両方で確認する
  accept: readonly { ext: string; mime: string }[];
};

export type ServiceDef = {
  id: ServiceId;
  steps: readonly StepDef[];
  files?: FileRule;
};

export type FormValue = string | string[] | boolean;
export type FormData = Record<string, FormValue | undefined>;

// ---------- 料金 ----------

// レッスン（指示書 v1.0 §3。2026-11-26 運営者確認済み）。追加費用（交通費など）は別途案内
export const lessonPlans = ["trial", "single", "intensive", "visiting"] as const;
export type LessonPlan = (typeof lessonPlans)[number];
export const lessonPlanPrices: Record<LessonPlan, { yen: number; minutes: number; monthly: boolean }> = {
  trial: { yen: 1000, minutes: 60, monthly: false },
  single: { yen: 6000, minutes: 60, monthly: false },
  intensive: { yen: 11000, minutes: 150, monthly: true },
  visiting: { yen: 10000, minutes: 120, monthly: false },
};

// 運指・ボウイング（指示書 v1.0 §4）。1 ページあたりの単価
export const bowingServices = ["fingering", "bowing", "both"] as const;
export type BowingService = (typeof bowingServices)[number];
export const bowingUnitPrice: Record<BowingService, number> = {
  fingering: 1000,
  bowing: 1000,
  both: 1500,
};
// これを超えるページ数は「割引・個別見積もりの相談可」と表示する（自動で割り引かない）
export const BOWING_CONSULT_PAGES = 10;
export const BOWING_MAX_PAGES = 300;

export type BowingQuote = {
  unitYen: number;
  pages: number;
  totalYen: number;
  consultDiscount: boolean;
};

export function quoteBowing(service: string | undefined, pagesRaw: unknown): BowingQuote | null {
  if (!service || !(bowingServices as readonly string[]).includes(service)) return null;
  const pages = typeof pagesRaw === "string" ? Number(pagesRaw) : typeof pagesRaw === "number" ? pagesRaw : NaN;
  if (!Number.isInteger(pages) || pages < 1 || pages > BOWING_MAX_PAGES) return null;
  const unitYen = bowingUnitPrice[service as BowingService];
  return { unitYen, pages, totalYen: unitYen * pages, consultDiscount: pages > BOWING_CONSULT_PAGES };
}

// ---------- フォームの定義 ----------

const NAME = 100;
const SHORT = 200;
const LONG = 4000;

export const lessonConcerns = [
  "pitch",
  "rhythm",
  "fingering",
  "bowing",
  "reading",
  "posture",
  "tone",
  "vibrato",
  "shifting",
  "practice",
  "other",
] as const;

export const serviceDefs: Record<ServiceId, ServiceDef> = {
  lesson: {
    id: "lesson",
    steps: [
      {
        key: "contact",
        fields: [
          { key: "name", type: "text", required: true, maxLength: NAME },
          { key: "email", type: "email", required: true, maxLength: SHORT },
          { key: "phone", type: "tel", required: true, maxLength: 30 },
        ],
      },
      {
        key: "plan",
        fields: [
          { key: "plan", type: "radio", required: true, options: lessonPlans },
          { key: "format", type: "radio", required: true, options: ["in_person", "visiting"] },
          { key: "travelArea", type: "text", requiredIf: { field: "format", equals: "visiting" }, maxLength: SHORT },
          { key: "preferred1", type: "datetime", required: true },
          { key: "preferred2", type: "datetime" },
          { key: "preferred3", type: "datetime" },
        ],
      },
      {
        key: "about",
        fields: [
          { key: "ageGroup", type: "select", options: ["child", "teen", "20s", "30s", "40s", "50s", "60plus", "undisclosed"] },
          { key: "experience", type: "select", required: true, options: ["none", "lt1", "1to3", "3to10", "gt10", "returning"] },
          { key: "level", type: "select", options: ["beginner", "elementary", "intermediate", "advanced"] },
          { key: "concerns", type: "checkboxes", options: lessonConcerns },
          { key: "goals", type: "textarea", required: true, maxLength: LONG },
          { key: "message", type: "textarea", maxLength: LONG },
          { key: "consent", type: "consent", required: true },
        ],
      },
    ],
  },
  bowing: {
    id: "bowing",
    steps: [
      {
        key: "contact",
        fields: [
          { key: "name", type: "text", required: true, maxLength: NAME },
          { key: "email", type: "email", required: true, maxLength: SHORT },
          { key: "phone", type: "tel", maxLength: 30 },
        ],
      },
      {
        key: "piece",
        fields: [
          { key: "instrument", type: "select", required: true, options: ["violin", "viola", "cello", "doublebass"] },
          { key: "title", type: "text", required: true, maxLength: SHORT },
          { key: "composer", type: "text", required: true, maxLength: SHORT },
          { key: "service", type: "radio", required: true, options: bowingServices },
          { key: "pages", type: "integer", required: true, min: 1, max: BOWING_MAX_PAGES },
          { key: "range", type: "text", maxLength: SHORT },
          { key: "level", type: "select", options: ["beginner", "intermediate", "advanced", "professional"] },
          { key: "deadline", type: "date" },
        ],
      },
      {
        key: "details",
        fields: [
          { key: "notes", type: "textarea", maxLength: LONG },
          { key: "message", type: "textarea", maxLength: LONG },
          { key: "rightsConfirm", type: "consent", required: true },
          { key: "consent", type: "consent", required: true },
        ],
      },
    ],
    files: {
      required: true,
      maxFiles: 5,
      maxBytes: 20 * 1024 * 1024,
      accept: [
        { ext: "pdf", mime: "application/pdf" },
        { ext: "png", mime: "image/png" },
        { ext: "jpg", mime: "image/jpeg" },
        { ext: "jpeg", mime: "image/jpeg" },
      ],
    },
  },
};

export function allFields(def: ServiceDef): FieldDef[] {
  return def.steps.flatMap((s) => [...s.fields]);
}

// ---------- 入力検証 ----------

export type FieldError = "required" | "email" | "tel" | "tooLong" | "invalidOption" | "integer" | "range" | "date" | "consent";
export type Errors = Record<string, FieldError>;

// RFC を厳密には追わず、よくある誤入力を弾く程度の形式チェック
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\-() ]{8,30}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isEmpty(v: FormValue | undefined): boolean {
  if (v === undefined || v === false) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function isRequired(field: FieldDef, data: FormData): boolean {
  if (field.required) return true;
  if (field.requiredIf) return data[field.requiredIf.field] === field.requiredIf.equals;
  return false;
}

export function validateField(field: FieldDef, data: FormData): FieldError | null {
  const v = data[field.key];
  if (isEmpty(v)) {
    if (!isRequired(field, data)) return null;
    return field.type === "consent" ? "consent" : "required";
  }
  switch (field.type) {
    case "consent":
      return v === true ? null : "consent";
    case "checkboxes": {
      if (!Array.isArray(v)) return "invalidOption";
      return v.every((x) => field.options?.includes(x)) ? null : "invalidOption";
    }
    default: {
      if (typeof v !== "string") return "invalidOption";
      const s = v.trim();
      if (field.maxLength && s.length > field.maxLength) return "tooLong";
      if (field.type === "email" && !EMAIL_RE.test(s)) return "email";
      if (field.type === "tel" && !TEL_RE.test(s)) return "tel";
      if ((field.type === "select" || field.type === "radio") && !field.options?.includes(s)) return "invalidOption";
      if (field.type === "datetime" && !DATETIME_RE.test(s)) return "date";
      if (field.type === "date" && !DATE_RE.test(s)) return "date";
      if (field.type === "integer") {
        const n = Number(s);
        if (!Number.isInteger(n)) return "integer";
        if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) return "range";
      }
      return null;
    }
  }
}

export function validateStep(step: StepDef, data: FormData): Errors {
  const errors: Errors = {};
  for (const f of step.fields) {
    const e = validateField(f, data);
    if (e) errors[f.key] = e;
  }
  return errors;
}

export function validateAll(def: ServiceDef, data: FormData): Errors {
  return Object.assign({}, ...def.steps.map((s) => validateStep(s, data)));
}

// 定義にない項目を落とし、文字列の前後の空白を除いた値だけを残す（保存する前に必ず通す）
export function sanitize(def: ServiceDef, data: FormData): FormData {
  const out: FormData = {};
  for (const f of allFields(def)) {
    const v = data[f.key];
    if (v === undefined) continue;
    if (typeof v === "string") out[f.key] = v.trim();
    else if (Array.isArray(v)) out[f.key] = v.filter((x) => typeof x === "string");
    else if (typeof v === "boolean") out[f.key] = v;
  }
  return out;
}

export type FileMeta = { name: string; size: number; type: string };

export type FileError = "required" | "tooMany" | "tooLarge" | "type";

export function validateFiles(rule: FileRule | undefined, files: readonly FileMeta[]): FileError | null {
  if (!rule) return files.length ? "tooMany" : null;
  if (rule.required && files.length === 0) return "required";
  if (files.length > rule.maxFiles) return "tooMany";
  for (const f of files) {
    if (!Number.isFinite(f.size) || f.size <= 0 || f.size > rule.maxBytes) return "tooLarge";
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!rule.accept.some((a) => a.ext === ext && a.mime === f.type)) return "type";
  }
  return null;
}

// 申し込み状態（指示書 v1.0 §9）
export const applicationStatuses = [
  "new",
  "reviewing",
  "quoted",
  "awaiting_reply",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
