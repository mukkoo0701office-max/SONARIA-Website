"use client";

import Tag from "@/components/ui/Tag";
import type { Dictionary } from "@/data/dictionaries/types";
import type { WorkSummary } from "@/data/works";
import type { Locale } from "@/lib/i18n";

type Props = {
  work: WorkSummary;
  locale: Locale;
  t: Dictionary["scores"];
  open: boolean;
  favorite: boolean;
  onToggleOpen: () => void;
  onToggleFavorite: () => void;
};

export default function WorkCard({ work, locale, t, open, favorite, onToggleOpen, onToggleFavorite }: Props) {
  const detailsId = `work-details-${work.id}`;
  const title = work.title[locale];

  return (
    <article className="my-3 rounded-card border border-line bg-card p-[17px]">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-[42px] w-[42px] flex-none place-items-center rounded-button bg-subtle" aria-hidden="true">
          ♫
        </div>
        <div className="flex-1">
          <h2 className="mb-1 text-base font-bold leading-[1.45]">{title}</h2>
          <div className="text-xs text-muted">{work.composer[locale]}</div>
        </div>
        {/* 仮: 保存はメモリ上のみ（再読み込みで消える）。永続化はプライバシー設計後 */}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={`${t.favorite}: ${title}`}
          className={favorite ? "text-xl text-gold" : "text-xl text-icon-muted"}
        >
          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
        </button>
      </div>

      <div className="my-3 flex flex-wrap items-center gap-1.5">
        <Tag>{work.players >= 5 ? t.playersOptions["5plus"] : t.playersCount(work.players)}</Tag>
        <Tag>{t.ensembleOptions[work.ensemble]}</Tag>
        <Tag>{t.formOptions[work.form]}</Tag>
        <Tag>
          {work.pdfCount} {t.pdf}
        </Tag>
      </div>

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-controls={detailsId}
        className="w-full rounded-button border border-navy bg-navy p-[11px] text-[13px] text-white transition-[filter] hover:brightness-95"
      >
        {open ? t.close : t.view}
      </button>

      {open && (
        <div id={detailsId} className="mt-3 rounded-button bg-paper p-[13px] text-[13px]">
          <strong>{t.details}</strong>
          <p className="my-2">{t.detailText}</p>
          {/* 権利確認（rights_status = approved）と実ファイルの接続まで、ダウンロードは無効にしておく */}
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-button border border-line bg-card px-[13px] py-[9px] text-[13px] text-muted opacity-70"
          >
            {t.download}
          </button>
        </div>
      )}
    </article>
  );
}
