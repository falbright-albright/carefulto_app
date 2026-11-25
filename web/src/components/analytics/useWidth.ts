import { useEffect, useRef, useState } from "react";

// Tracks an element's rendered width so SVG charts can lay out in real pixels
// (keeping marks at their specified thickness instead of scaling a viewBox).
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

// Round up to a clean axis maximum and pick ~4 evenly spaced ticks.
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const step2 = step < 1 ? 1 : step; // counts are integers
  const top = Math.ceil(max / step2) * step2;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step2) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// Column with a 4px rounded data-end and a square baseline.
export function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
