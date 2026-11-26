"use client";

type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
};

export default function Pagination({ page, totalPages, onChange, prevLabel, nextLabel }: Props) {
  if (totalPages <= 1) return null;

  const buttonClass =
    "rounded-button border border-line bg-card px-[13px] py-[9px] text-[13px] text-ink transition-[filter] hover:enabled:brightness-95 disabled:cursor-default disabled:opacity-35";

  return (
    <nav className="m-5 flex items-center justify-center gap-3" aria-label={`${prevLabel} / ${nextLabel}`}>
      <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={prevLabel}>
        ‹
      </button>
      <span aria-current="page">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label={nextLabel}
      >
        ›
      </button>
    </nav>
  );
}
