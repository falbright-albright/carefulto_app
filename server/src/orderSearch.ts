// Parsing for the admin order search (GET /api/admin/orders). Kept free of
// database code so it can be unit-tested.

export const ORDER_PAGE_SIZE = 50;
const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 100;

export interface OrderSearch {
  // Every term must appear somewhere in the order (AND). Each is matched
  // case-insensitively as a substring of: order number (CT-1001), customer
  // name and email, pickup and delivery address, courier name, item
  // category, status, price (e.g. 32.30) and the placed date in the
  // business timezone (e.g. "2026-11-24 November Nov 24").
  terms: string[];
  month: string | null; // "YYYY-MM": only orders placed in that month
  page: number; // 1-based
}

// Escape LIKE wildcards so a search for "50%" or "a_b" is taken literally.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function parseOrderSearch(params: URLSearchParams): OrderSearch | { error: string } {
  const terms = (params.get("q") ?? "")
    .split(/\s+/)
    // "$32.30" -> "32.30", "CT-1001," -> "CT-1001"
    .map((t) => t.replace(/^\$/, "").replace(/[,;]+$/, ""))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TERMS)
    .map((t) => escapeLike(t.slice(0, MAX_TERM_LENGTH)));

  const rawMonth = params.get("month")?.trim() || null;
  if (rawMonth !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
    return { error: "month must look like 2026-11" };
  }

  const rawPage = params.get("page");
  const page = rawPage === null || rawPage === "" ? 1 : Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return { error: "page must be a positive whole number" };
  }

  return { terms, month: rawMonth, page };
}

// CT-1001
export function formatOrderNumber(n: number): string {
  return `CT-${n}`;
}
