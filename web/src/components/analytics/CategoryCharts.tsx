import { useState } from "react";
import { monthLabel } from "@/lib/format";

export interface CategoryRow {
  category: string;
  month: number;
  allTime: number;
  byMonth: number[];
}

// Ranked horizontal bars: requests per item category for the chosen scope.
export function CategoryBars({ rows, scope }: { rows: CategoryRow[]; scope: "month" | "allTime" }) {
  const [hover, setHover] = useState<string | null>(null);
  const sorted = [...rows].sort(
    (a, b) => b[scope] - a[scope] || a.category.localeCompare(b.category),
  );
  const max = Math.max(1, ...sorted.map((r) => r[scope]));
  const total = sorted.reduce((s, r) => s + r[scope], 0);

  return (
    <ul className="max-w-2xl space-y-2" aria-label="Delivery requests by item category">
      {sorted.map((r) => {
        const v = r[scope];
        const share = total ? Math.round((v / total) * 100) : 0;
        return (
          <li
            key={r.category}
            className="grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,10.5rem)_1fr]"
            onMouseEnter={() => setHover(r.category)}
            onMouseLeave={() => setHover(null)}
            title={`${r.category}: ${v} requests (${share}% of total)`}
          >
            <span className="truncate text-[var(--a-ink-2)]">{r.category}</span>
            <span className="flex items-center gap-2">
              <span
                className="a-bar h-3.5 rounded-r-[4px]"
                style={{
                  width: v ? `max(3px, calc((100% - 4.5rem) * ${v / max}))` : 0,
                  background: "var(--a-data)",
                  opacity: hover === null || hover === r.category ? 1 : 0.35,
                }}
              />
              <span className="a-tabular whitespace-nowrap font-semibold">
                {v}
                {hover === r.category && v > 0 && (
                  <span className="ml-1 font-normal text-[var(--a-muted)]">{share}%</span>
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Light -> dark single-hue steps; text flips to white on the dark half.
const SEQ = [
  "var(--a-seq-0)",
  "var(--a-seq-1)",
  "var(--a-seq-2)",
  "var(--a-seq-3)",
  "var(--a-seq-4)",
  "var(--a-seq-5)",
];

function step(v: number, max: number): number {
  if (v <= 0) return 0;
  return Math.min(5, 1 + Math.floor((v / max) * 4.999));
}

// Categories x trailing 12 months, each cell shaded and labelled with its
// request count, plus an all-time total column.
export function CategoryHeatGrid({
  rows,
  months,
  selected,
}: {
  rows: CategoryRow[];
  months: string[];
  selected: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.byMonth));
  const sorted = [...rows].sort(
    (a, b) => b.allTime - a.allTime || a.category.localeCompare(b.category),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-[12px]">
        <caption className="sr-only">Delivery requests per item category per month</caption>
        <thead>
          <tr>
            <th className="text-left font-medium text-[var(--a-muted)]" scope="col">
              Category
            </th>
            {months.map((m) => (
              <th
                key={m}
                scope="col"
                className={
                  m === selected
                    ? "min-w-[2.25rem] font-semibold text-[var(--a-ink)]"
                    : "min-w-[2.25rem] font-medium text-[var(--a-muted)]"
                }
                title={monthLabel(m)}
              >
                {monthLabel(m, "short")}
                {m.endsWith("-01") && (
                  <span className="block text-[10px] font-normal">{m.slice(0, 4)}</span>
                )}
              </th>
            ))}
            <th scope="col" className="pl-2 text-right font-medium text-[var(--a-muted)]">
              All time
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.category}>
              <th
                scope="row"
                className="max-w-[10rem] truncate pr-2 text-left font-normal text-[var(--a-ink-2)]"
              >
                {r.category}
              </th>
              {r.byMonth.map((v, i) => {
                const s = step(v, max);
                return (
                  <td
                    key={months[i]}
                    className={`a-tabular h-8 rounded-[4px] text-center ${s >= 3 ? "text-white" : "text-[var(--a-ink)]"} ${months[i] === selected ? "outline outline-2 outline-offset-[-2px] outline-[var(--a-ink)]" : ""}`}
                    style={{ background: SEQ[s] }}
                    title={`${r.category}, ${monthLabel(months[i]!)}: ${v} requests`}
                  >
                    {v > 0 ? v : ""}
                  </td>
                );
              })}
              <td className="a-tabular pl-2 text-right font-semibold">{r.allTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
