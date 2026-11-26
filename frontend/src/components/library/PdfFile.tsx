"use client";

import { useState } from "react";
import type { Dictionary } from "@/data/dictionaries/types";
import { withBasePath } from "@/lib/paths";

type Props = {
  label: string;
  file: string; // public/ からのパス
  filename: string;
  pages: number;
  bytes: number;
  preview?: { file: string; width: number; height: number } | null;
  t: Dictionary["library"]["work"];
};

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// 1 ファイル（1 パート）の表示。PDF は「プレビュー」を押すまで読み込まない（通信量と表示速度のため）。
// 1 ページ目の画像があれば先に表示する（幅・高さを指定してレイアウトのずれを防ぐ）
export default function PdfFile({ label, file, filename, pages, bytes, preview, t }: Props) {
  const [open, setOpen] = useState(false);
  const src = withBasePath(file);
  const frameId = `pdf-${file.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <li className="rounded-card border border-line bg-card p-[13px]">
      <div className="flex gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBasePath(preview.file)}
            width={preview.width}
            height={preview.height}
            alt={t.previewAlt(label)}
            loading="lazy"
            decoding="async"
            className="h-auto w-20 flex-none rounded border border-line bg-white"
          />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold">{label}</h4>
          <p className="mt-0.5 break-all text-xs text-muted">{filename}</p>
          <p className="mt-0.5 text-xs text-muted">
            {t.pages(pages)} ・ {formatSize(bytes)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={frameId}
              className="rounded-button border border-navy bg-card px-3 py-2 text-[12px] font-semibold text-navy hover:bg-subtle"
            >
              {open ? t.closePreview : t.preview}
            </button>
            <a href={src} target="_blank" rel="noopener" className="rounded-button border border-navy bg-card px-3 py-2 text-[12px] font-semibold text-navy hover:bg-subtle">
              {t.open}
            </a>
            <a href={src} download={filename} className="rounded-button border border-navy bg-navy px-3 py-2 text-[12px] font-semibold text-white hover:brightness-95">
              {t.download}
            </a>
          </div>
        </div>
      </div>
      {open && <iframe id={frameId} src={src} title={t.iframeTitle(label)} className="mt-3 h-[75vh] w-full rounded border border-line bg-white" />}
    </li>
  );
}
