import { useState } from "react";
import { columnPath, niceTicks, useWidth } from "./useWidth";

interface Day {
  date: string; // YYYY-MM-DD
  deliveries: number;
  requests: number;
}

const H = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 32 };

function dayLabel(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", { ...opts, timeZone: "UTC" });
}

// Columns: deliveries completed on each day of the month. Days after today
// (in a month still in progress) are drawn as empty slots, not zeros.
export function DailyDeliveriesChart({ days, today }: { days: Day[]; today: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...days.map((d) => d.deliveries));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const plotW = Math.max(100, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / days.length;
  const barW = Math.min(24, Math.max(3, band - 2)); // 2px surface gap between neighbours
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = band < 18 ? 7 : band < 28 ? 3 : 1;

  const h = hover !== null ? days[hover] : undefined;
  const hx = hover !== null ? PAD.left + band * hover + band / 2 : 0;

  return (
    <div ref={ref} className="relative">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover only adds a tooltip; every value is also in the screen-reader table below */}
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Deliveries completed per day this month"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--a-axis)" : "var(--a-hair)"}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="a-tabular fill-[var(--a-muted)] text-[11px]"
            >
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const future = d.date > today;
          const dayNum = Number(d.date.slice(8));
          return (
            <g key={d.date}>
              {future ? (
                <rect
                  x={x}
                  y={PAD.top + plotH - 2}
                  width={barW}
                  height={2}
                  rx={1}
                  fill="var(--a-hair)"
                />
              ) : (
                <path
                  className="a-bar"
                  d={columnPath(x, y(d.deliveries), barW, PAD.top + plotH - y(d.deliveries))}
                  fill="var(--a-data)"
                  opacity={hover === null || hover === i ? 1 : 0.35}
                />
              )}
              {(dayNum === 1 || (dayNum - 1) % labelEvery === 0) && (
                <text
                  x={PAD.left + band * i + band / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="a-tabular fill-[var(--a-muted)] text-[11px]"
                >
                  {dayNum}
                </text>
              )}
              {/* Hit target spans the whole band, larger than the mark. */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: tooltip-only hover; values are in the screen-reader table */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute z-10 w-max rounded-lg border border-[var(--a-hair)] bg-[var(--a-surface)] px-3 py-2 text-[12px] shadow-[0_6px_20px_-8px_rgba(20,33,61,0.35)]"
          style={{
            left: Math.min(Math.max(hx - 70, 0), width - 150),
            top: Math.max(0, y(h.deliveries) - 70),
          }}
        >
          <div className="font-semibold">
            {dayLabel(h.date, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          {h.date > today ? (
            <div className="text-[var(--a-muted)]">Not yet</div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-[var(--a-data)]" />
                {h.deliveries} {h.deliveries === 1 ? "delivery" : "deliveries"}
              </div>
              <div className="text-[var(--a-muted)]">
                {h.requests} new {h.requests === 1 ? "request" : "requests"}
              </div>
            </>
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>Deliveries and requests per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Deliveries</th>
            <th>Requests</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.deliveries}</td>
              <td>{d.requests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 12-ish point trend line for the hero panel; the last real day gets a dot.
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const W = 220;
  const SH = 56;
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map(
    (v, i) => [(i / (values.length - 1)) * (W - 8) + 4, SH - 4 - (v / max) * (SH - 12)] as const,
  );
  const d = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join("");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={W} height={SH} className={className} aria-hidden>
      <path d={`${d}L${last[0]},${SH}L4,${SH}Z`} fill="currentColor" opacity={0.12} />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill="currentColor"
        stroke="var(--a-ink)"
        strokeWidth={2}
      />
    </svg>
  );
}
