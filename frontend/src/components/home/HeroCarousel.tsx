"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { siteImages } from "@/data/images";
import { heroSlides, pagePaths, type PageKey } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

// トップページのメインビジュアル（トップページ改修指示書 §3）。
// ページ全体ではなく、この枠の中だけでスライドを切り替えるカルーセル。
//
// 自動切替の仕様:
// - 6 秒ごとに次へ
// - 矢印・インジケーター・スワイプで操作したら、12 秒間は自動切替を止める
// - マウスを載せている間、キーボードのフォーカスがある間は止める
// - 「動きを減らす」設定の端末では最初から止めておく（再生ボタンで開始できる）
// - 5 秒を超えて自動で動くため、一時停止ボタンを必ず置く（WCAG 2.2.2）
const AUTOPLAY_MS = 3500; // 運営者の決定（2026-11-28。PR #25 の仕様どおり 3.5 秒ごと）
const HOLD_AFTER_MANUAL_MS = 12000;
const SWIPE_THRESHOLD_PX = 50;

// スライドの遷移先。「ホーム」のスライドはトップ自身ではなく「SONARIAについて」へ案内する
const slideTarget = (key: PageKey) => (key === "home" ? pagePaths.about : pagePaths[key]);

export default function HeroCarousel({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.hero;
  const total = heroSlides.length;

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [holdUntil, setHoldUntil] = useState(0);

  const rootRef = useRef<HTMLElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // 「動きを減らす」設定なら自動再生しない
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) setPlaying(false);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setPlaying(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const autoplayActive = playing && !hovered && !focusWithin;

  useEffect(() => {
    if (!autoplayActive) return;
    const delay = Math.max(AUTOPLAY_MS, holdUntil - Date.now());
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % total), delay);
    return () => window.clearTimeout(timer);
  }, [autoplayActive, index, holdUntil, total]);

  function goTo(next: number) {
    setIndex(((next % total) + total) % total);
    setHoldUntil(Date.now() + HOLD_AFTER_MANUAL_MS);
  }

  function handlePointerDown(event: React.PointerEvent) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // 横方向に十分動いたときだけスワイプとみなす（縦スクロールの邪魔をしない）
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      goTo(index + (dx < 0 ? 1 : -1));
    }
  }

  // スワイプ直後のクリックでリンクに飛ばないようにする
  function handleClickCapture(event: React.MouseEvent) {
    if (swiped.current) {
      event.preventDefault();
      event.stopPropagation();
      swiped.current = false;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    }
  }

  const currentSlide = heroSlides[index];

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={t.label}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="relative overflow-hidden rounded-card bg-navy">
        <div
          className="flex touch-pan-y select-none transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStart.current = null;
          }}
          onClickCapture={handleClickCapture}
        >
          {heroSlides.map((slide, i) => {
            const copy = t.slides[slide.key];
            const image = siteImages[slide.image];
            const active = i === index;
            return (
              <div
                key={slide.key}
                role="group"
                aria-roledescription="slide"
                aria-label={t.slideOf(i + 1, total)}
                inert={!active}
                className="relative w-full shrink-0"
              >
                <Link href={localizedPath(locale, slideTarget(slide.key))} draggable={false} className="group relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image の最適化は使えない */}
                  <img
                    src={withBasePath(image.src)}
                    width={image.width}
                    height={image.height}
                    alt={dict.images.alt[slide.image]}
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                    style={image.focus ? { objectPosition: image.focus } : undefined}
                    className="aspect-[4/5] w-full object-cover min-[480px]:aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]"
                  />
                  {/* 文字を読みやすくするための暗いグラデーション */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent sm:bg-gradient-to-r sm:from-navy/85 sm:via-navy/45 sm:to-transparent"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-x-0 bottom-0 px-6 pb-16 pt-6 text-white sm:inset-y-0 sm:flex sm:max-w-[68%] sm:flex-col sm:justify-center sm:px-12 sm:pb-12 lg:px-16">
                    <p className="text-[11px] tracking-[0.25em] text-gold" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-balance font-brand text-[26px] leading-tight sm:text-[34px] lg:text-[42px]">{copy.title}</p>
                    <p className="mt-3 text-sm leading-relaxed text-white/90 sm:text-base">{copy.catchCopy}</p>
                    <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-card px-5 py-2.5 text-[13px] font-semibold text-navy transition-colors group-hover:bg-paper">
                      {copy.cta}
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* 左右の矢印 */}
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label={t.prev}
          className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-navy shadow-sm hover:bg-card sm:flex"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label={t.next}
          className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-navy shadow-sm hover:bg-card sm:flex"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* インジケーター・矢印（スマホ）・一時停止 */}
      <div className="mt-3 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label={t.prev}
          className="flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-subtle sm:hidden"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <ul className="flex items-center">
          {heroSlides.map((slide, i) => (
            <li key={slide.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={t.goTo(i + 1, t.slides[slide.key].title)}
                aria-current={i === index ? "true" : undefined}
                className="flex h-8 w-6 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={i === index ? "block h-2 w-5 rounded-full bg-navy" : "block h-2 w-2 rounded-full bg-muted/50"}
                />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label={t.next}
          className="flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-subtle sm:hidden"
        >
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={() => setPlaying((prev) => !prev)}
          aria-label={playing ? t.pause : t.play}
          className="ml-2 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-navy hover:bg-subtle"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            {playing ? (
              <>
                <rect x="2" y="1" width="3.5" height="12" rx="1" />
                <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
              </>
            ) : (
              <path d="M3 1.5v11a.5.5 0 0 0 .76.43l9-5.5a.5.5 0 0 0 0-.86l-9-5.5A.5.5 0 0 0 3 1.5z" />
            )}
          </svg>
        </button>
      </div>

      {/* 手動で切り替えたときだけ読み上げる（自動切替中は読み上げない） */}
      <p className="sr-only" aria-live={autoplayActive ? "off" : "polite"} aria-atomic="true">
        {t.slideOf(index + 1, total)}: {t.slides[currentSlide.key].title}
      </p>
    </section>
  );
}
