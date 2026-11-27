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
  // Placed-date range in the business timezone, both ends inclusive
  // ("YYYY-MM-DD"). Either may be null for an open-ended range.
  from: string | null;
  to: string | null;
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

  const from = params.get("from")?.trim() || null;
  const to = params.get("to")?.trim() || null;
  for (const [name, value] of [
    ["from", from],
    ["to", to],
  ] as const) {
    if (value !== null && !isRealDate(value)) {
      return { error: `${name} must be a date like 2026-11-01` };
    }
  }
  // ISO dates compare correctly as strings.
  if (from !== null && to !== null && from > to) {
    return { error: "the From date must be on or before the To date" };
  }

  const rawPage = params.get("page");
  const page = rawPage === null || rawPage === "" ? 1 : Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return { error: "page must be a positive whole number" };
  }

  return { terms, from, to, page };
}

// "2026-11-31" has the right shape but isn't a day; reject it rather than
// letting Postgres fail with a 500.
function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

// CT-1001
export function formatOrderNumber(n: number): string {
  return `CT-${n}`;
}
