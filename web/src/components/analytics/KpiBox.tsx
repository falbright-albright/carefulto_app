import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  change: number | null; // relative change, e.g. 0.12 = +12%
  upIsGood?: boolean; // default true
  vs: string; // "vs October"
}

// One metric, one box: what it is, the figure, how it moved, how it's counted.
export function KpiBox({
  label,
  value,
  sub,
  delta,
  definition,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  definition: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-[148px] flex-col rounded-xl border border-[var(--a-hair)] bg-[var(--a-surface)] p-4",
        className,
      )}
      aria-label={label}
    >
      <h3 className="text-[13px] font-medium text-[var(--a-ink-2)]">{label}</h3>
      <p className="a-figure mt-3 text-[30px]">
        {value}
        {sub && (
          <span className="ml-1.5 text-[14px] font-medium tracking-normal text-[var(--a-muted)]">
            {sub}
          </span>
        )}
      </p>
      {delta && <Delta {...delta} />}
      <p className="mt-auto pt-3 text-[12px] leading-snug text-[var(--a-muted)]">{definition}</p>
    </section>
  );
}

function Delta({ change, upIsGood = true, vs }: KpiDelta) {
  if (change === null) {
    return (
      <p className="mt-2 text-[12px] text-[var(--a-muted)]">
        No comparison {vs.replace(/^vs /, "for ")}
      </p>
    );
  }
  const flat = Math.abs(change) < 0.005;
  const up = change > 0;
  const good = flat ? null : up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "mt-2 inline-flex items-center gap-1 text-[12px] font-semibold",
        good === null && "text-[var(--a-ink-2)]",
        good === true && "text-[var(--a-up)]",
        good === false && "text-[var(--a-down)]",
      )}
    >
      {!flat && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {flat ? "No change" : `${up ? "+" : "−"}${Math.abs(change * 100).toFixed(0)}%`}
      <span className="font-normal text-[var(--a-muted)]">{vs}</span>
    </p>
  );
}
