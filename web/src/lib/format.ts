import type { OrderStatus } from "./api";

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

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  placed: "secondary",
  recommended: "warning",
  accepted: "default",
  rejected: "destructive",
  completed: "warning",
  verified: "success",
  cancelled: "outline",
};
