// 申し込みの入力検証（Edge Function と Node のテストの両方から使う。Deno／Node 固有の API は使わない）
// フォームの送信内容（frontend の payload()）に合わせる:
//   - 統合申込 ServiceOrderForm: { service: lesson|bowing|recording, customer: { name, email, remarks }, estimateTotal, ... }
//   - 演奏依頼 PerformanceQuoteForm: { kind: "performance_quote", contact: { name, email }, consent, ... }
//   - 講師登録 TeacherRegistrationForm: { kind: "teacher_application", private: { legalName, email }, public: { displayName, ... }, agreements }

export type Kind = "lesson" | "bowing" | "recording" | "performance_quote" | "teacher_application";

export type Accepted = {
  ok: true;
  kind: Kind;
  locale: "ja" | "en";
  name: string;
  email: string;
  estimate: number | null;
  payload: Record<string, unknown>;
};
export type Rejected = { ok: false; errors: string[] };

export const MAX_BODY_BYTES = 20_000;
const MAX_STRING = 4_000;
const MAX_ARRAY = 50;
const MAX_DEPTH = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// 想定外の型・長すぎる文字列・深すぎる入れ子を拒否する（保存する JSON の大きさと形を抑える）
function checkShape(v: unknown, depth: number, path: string, errors: string[]): void {
  if (depth > MAX_DEPTH) {
    errors.push(`${path}: too deep`);
    return;
  }
  if (v === null || typeof v === "boolean") return;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) errors.push(`${path}: invalid number`);
    return;
  }
  if (typeof v === "string") {
    if (v.length > MAX_STRING) errors.push(`${path}: too long`);
    return;
  }
  if (Array.isArray(v)) {
    if (v.length > MAX_ARRAY) errors.push(`${path}: too many items`);
    v.forEach((x, i) => checkShape(x, depth + 1, `${path}[${i}]`, errors));
    return;
  }
  if (isObj(v)) {
    const keys = Object.keys(v);
    if (keys.length > MAX_ARRAY) errors.push(`${path}: too many keys`);
    for (const k of keys) checkShape(v[k], depth + 1, `${path}.${k}`, errors);
    return;
  }
  errors.push(`${path}: unsupported type`);
}

function detectKind(p: Obj): Kind | null {
  if (p.kind === "performance_quote" || p.kind === "teacher_application") return p.kind;
  if (p.service === "lesson" || p.service === "bowing" || p.service === "recording") return p.service;
  return null;
}

export function validateSubmission(input: unknown): Accepted | Rejected {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["body: object required"] };
  checkShape(input, 0, "body", errors);

  const kind = detectKind(input);
  if (!kind) errors.push("kind: unknown");
  const locale = input.locale === "en" ? "en" : input.locale === "ja" ? "ja" : null;
  if (!locale) errors.push("locale: ja or en");

  let name = "";
  let email = "";
  let estimate: number | null = null;

  if (kind === "lesson" || kind === "bowing" || kind === "recording") {
    const c = isObj(input.customer) ? input.customer : {};
    name = str(c.name);
    email = str(c.email);
    if (!isObj(input[kind])) errors.push(`${kind}: details required`);
    // 画面の概算は参考値として保存する（料金の確定は管理人が行う）
    const e = input.estimateTotal;
    if (typeof e === "number" && Number.isInteger(e) && e >= 0 && e <= 10_000_000) estimate = e;
  } else if (kind === "performance_quote") {
    const c = isObj(input.contact) ? input.contact : {};
    name = str(c.name);
    email = str(c.email);
    if (input.consent !== true) errors.push("consent: required");
  } else if (kind === "teacher_application") {
    const priv = isObj(input.private) ? input.private : {};
    const pub = isObj(input.public) ? input.public : {};
    const ag = isObj(input.agreements) ? input.agreements : {};
    name = str(priv.legalName) || str(pub.displayName);
    email = str(priv.email);
    if (!str(pub.displayName)) errors.push("public.displayName: required");
    if (ag.eligibility !== true || ag.publish !== true || ag.privacy !== true) errors.push("agreements: all required");
  }

  if (kind) {
    if (name.length < 1 || name.length > 100) errors.push("name: 1-100 chars");
    if (email.length > 254 || !EMAIL.test(email)) errors.push("email: invalid");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, kind: kind as Kind, locale: locale as "ja" | "en", name, email, estimate, payload: input };
}

// Origin の許可判定。許可リストは完全一致（末尾スラッシュなし）
export function isAllowedOrigin(origin: string | null, allowed: string[]): boolean {
  return !!origin && allowed.includes(origin);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
