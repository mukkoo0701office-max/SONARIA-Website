"use client";

import Link from "next/link";
import type { FieldDef, FieldError, FormData } from "@shared/schema";
import { isRequired } from "@shared/schema";
import type { FieldCopy } from "@/data/dictionaries/forms/types";

type Props = {
  field: FieldDef;
  copy: FieldCopy;
  data: FormData;
  error?: FieldError;
  errorText?: string;
  requiredLabel: string;
  optionalLabel: string;
  privacyHref: string;
  privacyLabel: string;
  onChange: (key: string, value: string | string[] | boolean) => void;
  // ラジオの選択肢の下に料金などを添える
  optionExtra?: (option: string) => React.ReactNode;
  optionLabel?: (option: string) => string;
};

const inputClass =
  "w-full rounded-control border border-muted bg-card p-[13px] text-ink aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger";

// フォームの 1 項目。項目の種類（schema の FieldType）に応じて入力欄を切り替える
export default function FormField({
  field,
  copy,
  data,
  error,
  errorText,
  requiredLabel,
  optionalLabel,
  privacyHref,
  privacyLabel,
  onChange,
  optionExtra,
  optionLabel,
}: Props) {
  const id = `field-${field.key}`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const required = isRequired(field, data);
  const describedBy = [copy.help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const value = data[field.key];
  const labelFor = (opt: string) => optionLabel?.(opt) ?? copy.options?.[opt] ?? opt;

  const badge = (
    <span className={required ? "ml-2 rounded-tag bg-navy px-1.5 py-0.5 text-[10px] text-white" : "ml-2 text-[11px] text-muted"}>
      {required ? requiredLabel : optionalLabel}
    </span>
  );

  const help = copy.help ? (
    <p id={helpId} className="text-xs text-muted">
      {copy.help}
    </p>
  ) : null;
  const err = error ? (
    <p id={errorId} className="text-[13px] font-semibold text-danger">
      {errorText}
    </p>
  ) : null;

  if (field.type === "consent") {
    return (
      <div className="grid gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-[14px]">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(field.key, e.target.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="mt-0.5 h-5 w-5 shrink-0 accent-navy"
          />
          <span>
            {copy.label}
            {badge}
            {field.key === "consent" && (
              <>
                {" "}
                <Link href={privacyHref} target="_blank" className="text-navy underline">
                  {privacyLabel}
                </Link>
              </>
            )}
          </span>
        </label>
        {err}
      </div>
    );
  }

  if (field.type === "radio" || field.type === "checkboxes") {
    const multi = field.type === "checkboxes";
    const selected = multi ? (Array.isArray(value) ? value : []) : value;
    return (
      <fieldset className="grid gap-2" aria-describedby={describedBy}>
        <legend className="mb-1 text-[13px] font-semibold">
          {copy.label}
          {badge}
        </legend>
        {help}
        <div className={multi ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "grid gap-2 sm:grid-cols-2"}>
          {(field.options ?? []).map((opt) => {
            const checked = multi ? (selected as string[]).includes(opt) : selected === opt;
            return (
              <label
                key={opt}
                className={
                  checked
                    ? "flex cursor-pointer items-start gap-2.5 rounded-control border-2 border-navy bg-card p-3 text-[14px]"
                    : "flex cursor-pointer items-start gap-2.5 rounded-control border border-muted bg-card p-3 text-[14px]"
                }
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={id}
                  value={opt}
                  checked={checked}
                  onChange={(e) => {
                    if (multi) {
                      const cur = selected as string[];
                      onChange(field.key, e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt));
                    } else {
                      onChange(field.key, opt);
                    }
                  }}
                  aria-invalid={error ? true : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
                />
                <span>
                  <span className="block">{labelFor(opt)}</span>
                  {optionExtra?.(opt)}
                </span>
              </label>
            );
          })}
        </div>
        {err}
      </fieldset>
    );
  }

  const common = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  } as const;
  const str = typeof value === "string" ? value : "";

  let control: React.ReactNode;
  if (field.type === "textarea") {
    control = (
      <textarea
        {...common}
        rows={5}
        maxLength={field.maxLength}
        placeholder={copy.placeholder}
        value={str}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={inputClass}
      />
    );
  } else if (field.type === "select") {
    control = (
      <select {...common} value={str} onChange={(e) => onChange(field.key, e.target.value)} className={inputClass}>
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(opt)}
          </option>
        ))}
      </select>
    );
  } else {
    const type =
      field.type === "email"
        ? "email"
        : field.type === "tel"
          ? "tel"
          : field.type === "integer"
            ? "number"
            : field.type === "datetime"
              ? "datetime-local"
              : field.type === "date"
                ? "date"
                : "text";
    const autoComplete = field.key === "name" ? "name" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "off";
    control = (
      <input
        {...common}
        type={type}
        inputMode={field.type === "integer" ? "numeric" : undefined}
        min={field.type === "integer" ? field.min : undefined}
        max={field.type === "integer" ? field.max : undefined}
        step={field.type === "integer" ? 1 : undefined}
        maxLength={field.maxLength}
        autoComplete={autoComplete}
        placeholder={copy.placeholder}
        value={str}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {copy.label}
        {badge}
      </label>
      {help}
      {control}
      {err}
    </div>
  );
}
