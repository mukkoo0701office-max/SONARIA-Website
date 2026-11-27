"use client";

// 管理画面のグラフ（SVG を手書き。外部ライブラリは使わない）。
// 方針（dataviz）: 細い線（2px）・棒の先端だけ角丸・塗りの間に 2px の隙間・目盛りと格子は控えめ・
// 2 系列以上は凡例を必ず出す・ホバー／フォーカスで値を表示・「表で見る」で同じ数値を表でも確認できる・
// 縦軸は 1 本だけ（2 軸グラフにしない）。文字は ink / muted で書き、系列の色は文字に使わない

import { useId, useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { chartAxis, chartGrid, chartPrimary } from "./theme";
import { Segmented } from "./ui";

export type Series = { key: string; label: string; color: string; values: number[] };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

function Legend({ series }: { series: { label: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ labels, series, format }: { labels: string[]; series: Series[]; format: (n: number) => string }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-card text-muted">
          <tr>
            <th className="py-1 pr-3 text-left font-semibold" />
            {series.map((s) => (
              <th key={s.key} className="py-1 pr-3 text-right font-semibold">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {labels.map((l, i) => (
            <tr key={`${l}-${i}`}>
              <th className="py-1 pr-3 text-left font-normal">{l}</th>
              {series.map((s) => (
                <td key={s.key} className="py-1 pr-3 text-right">
                  {format(s.values[i] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 表示の切り替え（グラフ／表） */
function ChartFrame({ title, children, table }: { title: string; children: React.ReactNode; table: React.ReactNode }) {
  const { t } = useAdmin();
  const [mode, setMode] = useState<"chart" | "table">("chart");
  return (
    <figure className="min-w-0">
      <div className="mb-2 flex justify-end">
        <Segmented
          label={title}
          value={mode}
          onChange={setMode}
          options={[
            { value: "chart", label: t.common.chart },
            { value: "table", label: t.common.table },
          ]}
        />
      </div>
      {mode === "chart" ? children : table}
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

/** 目盛りの文字を出すか。最後の点は、直前の目盛りから十分離れているときだけ出す（文字の重なりを防ぐ） */
function showTick(i: number, n: number, every: number) {
  if (i !== n - 1) return i % every === 0;
  const gap = (n - 1) % every; // 直前の目盛りからの距離
  return gap === 0 || gap >= Math.ceil(every / 2);
}

const W = 640;
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

/** 折れ線（時系列）。十字線とツールチップ付き */
export function LineChart({ title, labels, series, format, height = 220 }: { title: string; labels: string[]; series: Series[]; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const iw = W - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const tickEvery = Math.max(1, Math.ceil(labels.length / 7));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw;
    setHover(Math.max(0, Math.min(labels.length - 1, Math.round((px / iw) * (labels.length - 1)))));
  }

  return (
    <ChartFrame title={title} table={<DataTable labels={labels} series={series} format={format} />}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{title}</title>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke={chartGrid} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill={chartAxis}>
                {format(max * f)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            showTick(i, labels.length, tickEvery) ? (
              <text key={`${l}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={chartAxis}>
                {l}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke={chartAxis} strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={iw}
            height={ih}
            fill="transparent"
            tabIndex={0}
            aria-label={title}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(labels.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? 0) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(labels.length - 1, (h ?? 0) + 1));
            }}
            className="focus:outline-none"
          />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-control border border-line bg-card px-3 py-2 text-[12px] shadow-sm"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W * 0.6 ? "translateX(-105%)" : "translateX(8px)" }}
            role="status"
          >
            <p className="font-semibold">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}: {format(s.values[hover] ?? 0)}
              </p>
            ))}
          </div>
        )}
      </div>
      <Legend series={series} />
    </ChartFrame>
  );
}

/** 棒グラフ（1 系列または積み上げ） */
export function BarChart({ title, labels, series, format, height = 220, stacked = false }: { title: string; labels: string[]; series: Series[]; format: (n: number) => string; height?: number; stacked?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const totals = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0))));
  const max = niceMax(Math.max(1, ...totals));
  const iw = W - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / Math.max(1, labels.length);
  const groupW = Math.min(band * 0.7, 48);
  const y = (v: number) => (v / max) * ih;
  const base = PAD.top + ih;
  const tickEvery = Math.max(1, Math.ceil(labels.length / 12));

  return (
    <ChartFrame title={title} table={<DataTable labels={labels} series={series} format={format} />}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{title}</title>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={base - y(max * f)} y2={base - y(max * f)} stroke={chartGrid} strokeWidth={1} />
              <text x={PAD.left - 8} y={base - y(max * f) + 4} textAnchor="end" fontSize={11} fill={chartAxis}>
                {format(max * f)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = PAD.left + band * i + band / 2;
            let acc = 0;
            const bars = stacked
              ? series.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  const h = y(v);
                  const top = base - y(acc) - h;
                  acc += v;
                  const isTop = k === series.length - 1 || series.slice(k + 1).every((n) => (n.values[i] ?? 0) === 0);
                  // 2px の隙間で区切る。いちばん上の塗りだけ角を丸める
                  return h > 0 ? <rect key={s.key} x={cx - groupW / 2} y={top + 1} width={groupW} height={Math.max(0, h - 2)} rx={isTop ? 4 : 0} fill={s.color} /> : null;
                })
              : series.map((s, k) => {
                  const w = groupW / series.length;
                  const h = y(s.values[i] ?? 0);
                  return <rect key={s.key} x={cx - groupW / 2 + k * w + 1} y={base - h} width={Math.max(1, w - 2)} height={h} rx={Math.min(4, h / 2)} fill={s.color} />;
                });
            return (
              <g key={`${l}-${i}`}>
                {bars}
                {showTick(i, labels.length, tickEvery) && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={chartAxis}>
                    {l}
                  </text>
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={ih}
                  fill={hover === i ? "rgba(24,43,69,0.05)" : "transparent"}
                  tabIndex={0}
                  aria-label={`${l}: ${format(totals[i])}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="focus:outline-none"
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-control border border-line bg-card px-3 py-2 text-[12px] shadow-sm"
            style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`, transform: hover > labels.length * 0.6 ? "translateX(-105%)" : "translateX(8px)" }}
            role="status"
          >
            <p className="font-semibold">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}: {format(s.values[hover] ?? 0)}
              </p>
            ))}
            {stacked && series.length > 1 && <p className="mt-1 border-t border-line pt-1 font-semibold tabular-nums">{format(totals[hover])}</p>}
          </div>
        )}
      </div>
      <Legend series={series} />
    </ChartFrame>
  );
}

/** ドーナツ（構成比）。凡例に値と割合を並べる */
export function DonutChart({ title, items, format }: { title: string; items: { key: string; label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const { locale } = useAdmin();
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((a, b) => a + b.value, 0);
  const arcs = useMemo(() => {
    let a0 = -Math.PI / 2;
    return items
      .filter((i) => i.value > 0)
      .map((i) => {
        const a1 = a0 + (i.value / Math.max(1, total)) * Math.PI * 2;
        const gap = 0.012; // 塗りの間の隙間
        const arc = { ...i, a0: a0 + gap, a1: a1 - gap };
        a0 = a1;
        return arc;
      });
  }, [items, total]);
  const R = 70;
  const r = 44;
  const pt = (a: number, rad: number) => `${100 + rad * Math.cos(a)},${100 + rad * Math.sin(a)}`;
  const pct = (v: number) => new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", { style: "percent", maximumFractionDigits: 1 }).format(v / Math.max(1, total));

  return (
    <ChartFrame
      title={title}
      table={<DataTable labels={items.map((i) => i.label)} series={[{ key: "v", label: title, color: chartPrimary, values: items.map((i) => i.value) }]} format={format} />}
    >
      {/* 縦に並べる（狭いカードでも凡例の金額がはみ出さない） */}
      <div className="grid min-w-0 gap-4">
        <svg viewBox="0 0 200 200" className="mx-auto h-auto w-full max-w-[180px]" role="img" aria-label={title}>
          {arcs.map((a) => {
            const large = a.a1 - a.a0 > Math.PI ? 1 : 0;
            const d = `M ${pt(a.a0, R)} A ${R} ${R} 0 ${large} 1 ${pt(a.a1, R)} L ${pt(a.a1, r)} A ${r} ${r} 0 ${large} 0 ${pt(a.a0, r)} Z`;
            return <path key={a.key} d={d} fill={a.color} opacity={hover && hover !== a.key ? 0.35 : 1} onPointerEnter={() => setHover(a.key)} onPointerLeave={() => setHover(null)} />;
          })}
          <text x={100} y={96} textAnchor="middle" fontSize={11} fill={chartAxis}>
            {hover ? items.find((i) => i.key === hover)?.label.slice(0, 12) : ""}
          </text>
          <text x={100} y={114} textAnchor="middle" fontSize={15} fontWeight={700} fill="#182B45">
            {hover ? pct(items.find((i) => i.key === hover)?.value ?? 0) : format(total)}
          </text>
        </svg>
        <ul className="grid gap-1 text-[12px]">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 border-b border-line py-1 last:border-0" onPointerEnter={() => setHover(i.key)} onPointerLeave={() => setHover(null)}>
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-sm" style={{ background: i.color }} />
                <span className="truncate">{i.label}</span>
              </span>
              <span className="text-right tabular-nums text-muted">
                {format(i.value)}・{pct(i.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

/** 横棒の順位表（人気の楽譜など）。数値は棒の右に文字で出す */
export function RankBars({ items, format }: { items: { key: string; label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="grid gap-2">
      {items.map((i, n) => (
        <li key={i.key} className="grid grid-cols-[1.5rem_1fr] items-center gap-2 text-[13px]">
          <span className="text-right tabular-nums text-muted">{n + 1}</span>
          <div className="min-w-0">
            <div className="flex justify-between gap-2">
              <span className="truncate">{i.label}</span>
              <span className="tabular-nums text-muted">{format(i.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-subtle">
              <div className="h-1.5 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: chartPrimary }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
