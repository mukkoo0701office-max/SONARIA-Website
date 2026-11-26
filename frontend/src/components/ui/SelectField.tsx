"use client";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  id: string;
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
};

export default function SelectField<T extends string>({ id, label, value, options, onChange }: Props<T>) {
  return (
    <div className="my-4 grid gap-[7px]">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-control border border-line bg-card p-[13px] text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
