"use client";

import { useRef, useState } from "react";
import type { getDictionary } from "@/data/dictionaries";
import { MAX_FILES, uploadScore, type UploadedFile, type UploadError } from "@/lib/orders/upload";

type T = ReturnType<typeof getDictionary>["orderForm"]["bowing"]["upload"];
type Item = { id: string; name: string; state: "uploading" | "done" | "error"; error?: UploadError; file?: UploadedFile };

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// 楽譜 PDF の添付（任意）。選んだらすぐ送る。送っている間は申込を確認画面へ進めない（onBusy）
export default function ScoreUpload({ t, onChange, onBusy }: { t: T; onChange: (files: UploadedFile[]) => void; onBusy: (busy: boolean) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function publish(next: Item[]) {
    setItems(next);
    onChange(next.filter((i) => i.state === "done" && i.file).map((i) => i.file as UploadedFile));
    onBusy(next.some((i) => i.state === "uploading"));
  }

  async function add(list: FileList | null) {
    if (!list) return;
    const room = MAX_FILES - items.filter((i) => i.state !== "error").length;
    const picked = Array.from(list).slice(0, Math.max(room, 0));
    setTooMany(list.length > room);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;
    let current = [...items, ...picked.map((f) => ({ id: crypto.randomUUID(), name: f.name, state: "uploading" as const }))];
    publish(current);
    await Promise.all(
      picked.map(async (f, k) => {
        const id = current[items.length + k].id;
        const r = await uploadScore(f);
        current = current.map((i) => (i.id !== id ? i : r.ok ? { ...i, state: "done", file: r.file } : { ...i, state: "error", error: r.error }));
        publish(current);
      }),
    );
  }

  function remove(id: string) {
    // 送信前に外したファイルは申込に含めない（保存済みのファイルは管理人だけが読める非公開の場所に残り、後で整理する）
    publish(items.filter((i) => i.id !== id));
    setTooMany(false);
  }

  const full = items.filter((i) => i.state !== "error").length >= MAX_FILES;
  return (
    <div>
      <p className="text-[15px] font-bold">{t.label}</p>
      <p className="mt-1 text-[13px] text-muted">{t.help}</p>
      <label className={`mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-button border border-navy px-4 text-[14px] font-semibold text-navy has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy ${full ? "pointer-events-none opacity-50" : "hover:bg-subtle"}`}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple disabled={full} className="sr-only" onChange={(e) => add(e.target.files)} />
        {t.choose}
      </label>
      {tooMany && <p role="alert" className="mt-2 text-[13px] text-[#9b2c2c]">{t.errors.too_many}</p>}
      {items.length > 0 && (
        <ul className="mt-3 grid gap-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-[13px]">
              <span className="min-w-0 break-all">
                {i.name}
                {i.file && <span className="ml-1 text-muted">（{sizeText(i.file.size)}）</span>}
                <span className={`block text-[12px] ${i.state === "error" ? "text-[#9b2c2c]" : "text-muted"}`}>
                  {i.state === "uploading" ? t.uploading : i.state === "done" ? t.uploaded : t.errors[i.error ?? "failed"]}
                </span>
              </span>
              {i.state !== "uploading" && (
                <button type="button" onClick={() => remove(i.id)} className="min-h-11 rounded-button px-3 text-[13px] text-navy underline">
                  {t.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
