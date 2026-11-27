import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5];

// Read-only stars: `value` may be fractional (an average); a star is filled
// when value rounds up to it (4.6 -> 5 filled, 4.4 -> 4).
export function Stars({
  value,
  className,
  size = "sm",
  showValue = true,
}: {
  value: number;
  className?: string;
  size?: "sm" | "lg";
  showValue?: boolean;
}) {
  const filled = Math.round(value);
  const px = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={`${formatStars(value)} out of 5 stars`}
    >
      <span className="inline-flex">
        {STARS.map((n) => (
          <Star
            key={n}
            aria-hidden
            className={cn(
              px,
              n <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      {showValue && <span className="text-xs text-muted-foreground">{formatStars(value)}/5</span>}
    </span>
  );
}

// "4" for whole numbers, "4.6" for averages.
export function formatStars(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Clickable 1–5 star picker. Clicking the selected star again clears it,
// since the rating is optional.
export function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <fieldset className="flex gap-1" aria-label="Rate the delivery">
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(value === n ? null : n)}
        >
          <Star
            className={cn(
              "h-8 w-8 transition-colors",
              n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </fieldset>
  );
}
