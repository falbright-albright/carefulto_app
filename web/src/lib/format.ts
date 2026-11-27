import type { OrderStatus, SupportKind, SupportStatus } from "./api";

// 1001 -> "CT-1001": the reference customers and admins quote.
export function orderNo(n: number): string {
  return `CT-${n}`;
}

export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  recommended: "Recommended",
  accepted: "Accepted",
  rejected: "Rejected",
  completed: "Awaiting verification",
  verified: "Verified · Done",
  cancelled: "Cancelled",
};

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  placed: "secondary",
  recommended: "warning",
  accepted: "default",
  rejected: "destructive",
  completed: "warning",
  verified: "success",
  cancelled: "outline",
};

// "2026-07" -> "July 2026"
export function monthLabel(ym: string, style: "long" | "short" = "long"): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleString("en-CA", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

// Every month from `first` to `last` inclusive, newest first.
export function monthRange(first: string, last: string): string[] {
  const toIdx = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return y! * 12 + m! - 1;
  };
  const out: string[] = [];
  for (let i = toIdx(last); i >= toIdx(first); i--) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

// 1,284 / 12.9K / 4.2M
export function compact(n: number): string {
  if (Math.abs(n) < 10_000) return n.toLocaleString("en-CA", { maximumFractionDigits: 1 });
  return new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

// Relative change from prev to cur, or null when there's no baseline.
export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}

// 95 -> "1 h 35 min", 40 -> "40 min"
export function minutes(m: number): string {
  const r = Math.round(m);
  if (r < 60) return `${r} min`;
  const h = Math.floor(r / 60);
  const rest = r % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

// --- support requests ("Contact us") ---

export const SUPPORT_KIND_LABEL: Record<SupportKind, string> = {
  delivery: "Problem with a delivery",
  courier: "Problem with a courier",
  question: "Question",
  comment: "Comment",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
};

export const SUPPORT_STATUS_VARIANT: Record<SupportStatus, BadgeVariant> = {
  open: "warning",
  in_review: "secondary",
  resolved: "success",
};

// What we promise on submit, and repeat on the Contact us tab.
export const SUPPORT_REPLY_PROMISE = "We'll reply within 24 hours.";
