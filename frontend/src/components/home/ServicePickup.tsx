"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { siteImages } from "@/data/images";
import { services } from "@/data/services";
import { pagePaths } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

// 有料サービスのピックアップ（トップページ改修指示書 §5）。
// 横スクロール（scroll-snap）で、PC は 4 枚並び、スマホは 1〜2 枚ずつ見せてスワイプで移動する。
// カードの中身は src/data/services.ts の配列から作る。
export default function ServicePickup({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.servicesPickup;
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [updateButtons]);

  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: step * direction, behavior: reduce ? "auto" : "smooth" });
  }

  const arrowClass =
    "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-navy hover:bg-subtle disabled:cursor-default disabled:opacity-35";

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="pickup-heading" className="font-brand text-2xl tracking-[0.04em] sm:text-3xl">
            {t.heading}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.lead}</p>
        </div>
        {(canPrev || canNext) && (
          <div className="flex gap-2">
            <button type="button" className={arrowClass} onClick={() => scrollByCard(-1)} disabled={!canPrev} aria-label={t.prev}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" className={arrowClass} onClick={() => scrollByCard(1)} disabled={!canNext} aria-label={t.next}>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        )}
      </div>

      <ul
        ref={scrollerRef}
        className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {services.map((service) => {
          const copy = t.items[service.key];
          const image = siteImages[service.image];
          return (
            <li
              key={service.key}
              className="w-[78%] shrink-0 snap-start min-[560px]:w-[46%] lg:w-[calc((100%-48px)/4)]"
            >
              <Link
                href={localizedPath(locale, pagePaths[service.page])}
                className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-card transition-shadow hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image の最適化は使えない */}
                <img
                  src={withBasePath(image.src)}
                  width={image.width}
                  height={image.height}
                  alt={dict.images.alt[service.image]}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-[17px]">
                  <h3 className="text-base font-bold">{copy.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{copy.body}</p>
                  {/* 料金は詳細ページで設定してから表示する（未設定なら出さない） */}
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-navy group-hover:underline">
                    {dict.common.learnMore}
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">{t.note}</p>
    </div>
  );
}
