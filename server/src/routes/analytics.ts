import { sql } from "../db.ts";
import { json, error } from "../http.ts";
import { config } from "../config.ts";
import { ITEM_CATEGORIES } from "../categories.ts";
import { backfillPickupRegions, ensureBaselineRegions } from "../regions.ts";

// ---------------------------------------------------------------------------
// Admin analytics. All day/month bucketing is done in the business time zone
// (config.analyticsTimeZone, default America/Toronto).
//
// Definitions (kept here so the dashboard and the SQL can't drift apart):
//   request   — an order placed (any status), dated by created_at
//   delivery  — an order the courier reported delivered (status completed or
//               verified), dated by courier_verified_at, the moment of report
//   revenue   — sum of the price of deliveries (price is recorded, not charged)
// ---------------------------------------------------------------------------

export interface Month {
  year: number;
  month: number; // 1-12
}

// "2026-07" -> { year: 2026, month: 7 }; anything else -> null.
export function parseMonth(raw: string | null): Month | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function shiftMonth({ year, month }: Month, by: number): Month {
  const i = year * 12 + (month - 1) + by;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

export function formatMonth({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// The current month in the business time zone.
export function currentMonth(now = new Date(), timeZone = config.analyticsTimeZone): Month {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") };
}

// Start of a month as a timestamptz in the business time zone.
const monthStart = (m: Month) =>
  sql`make_timestamptz(${m.year}, ${m.month}, 1, 0, 0, 0, ${config.analyticsTimeZone})`;

const DELIVERED = sql`o.status IN ('completed', 'verified') AND o.courier_verified_at IS NOT NULL`;

interface PeriodStats {
  requests: number;
  deliveries: number;
  revenue: number;
  avgPrice: number | null;
  avgDistanceKm: number | null;
  activeCouriers: number;
  deliveriesPerActiveCourier: number | null;
  requestingCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  offers: number;
  offersAccepted: number;
  avgMinutesToAccept: number | null;
}

// Stats for month `m`. `cutoff` optionally ends the period early (used to
// compare a month in progress against the same stretch of the month before).
type Fragment = ReturnType<typeof monthStart>;

async function periodStats(m: Month, cutoff?: Fragment): Promise<PeriodStats> {
  const s = monthStart(m);
  const e = cutoff ?? monthStart(shiftMonth(m, 1));
  const [d] = await sql`
    SELECT count(*)::int                         AS deliveries,
           COALESCE(sum(o.price), 0)::float       AS revenue,
           avg(o.price)::float                    AS avg_price,
           avg(o.distance_km)::float              AS avg_km,
           count(DISTINCT o.courier_id)::int      AS active_couriers
    FROM orders o
    WHERE ${DELIVERED} AND o.courier_verified_at >= ${s} AND o.courier_verified_at < ${e}
  `;
  const [r] = await sql`
    WITH per AS (
      SELECT customer_id, count(*) AS n FROM orders
      WHERE created_at >= ${s} AND created_at < ${e}
      GROUP BY customer_id
    )
    SELECT COALESCE(sum(n), 0)::int                  AS requests,
           count(*)::int                             AS requesting_customers,
           count(*) FILTER (WHERE n >= 2)::int       AS repeat_customers
    FROM per
  `;
  const [c] = await sql`
    SELECT count(*)::int AS n FROM users
    WHERE role = 'customer' AND created_at >= ${s} AND created_at < ${e}
  `;
  // Courier offers: each recommendation is one event addressed to one courier.
  // Accept events fan out to several recipients, so count distinct orders.
  const [x] = await sql`
    SELECT
      (SELECT count(*) FROM order_events
        WHERE type = 'order_recommended' AND created_at >= ${s} AND created_at < ${e})::int AS offers,
      (SELECT count(DISTINCT order_id) FROM order_events
        WHERE type = 'order_accepted' AND created_at >= ${s} AND created_at < ${e})::int AS accepted
  `;
  const [t] = await sql`
    SELECT avg(EXTRACT(EPOCH FROM (a.first_accept - o.created_at)) / 60)::float AS minutes
    FROM orders o
    JOIN (
      SELECT order_id, min(created_at) AS first_accept FROM order_events
      WHERE type = 'order_accepted' GROUP BY order_id
    ) a ON a.order_id = o.id
    WHERE o.created_at >= ${s} AND o.created_at < ${e}
  `;
  const deliveries = d!.deliveries as number;
  const activeCouriers = d!.active_couriers as number;
  return {
    requests: r!.requests,
    deliveries,
    revenue: d!.revenue,
    avgPrice: d!.avg_price,
    avgDistanceKm: d!.avg_km,
    activeCouriers,
    deliveriesPerActiveCourier: activeCouriers > 0 ? deliveries / activeCouriers : null,
    requestingCustomers: r!.requesting_customers,
    repeatCustomers: r!.repeat_customers,
    newCustomers: c!.n,
    offers: x!.offers,
    offersAccepted: x!.accepted,
    avgMinutesToAccept: t!.minutes,
  };
}

// GET /api/admin/analytics?month=YYYY-MM  (admin; defaults to this month)
export async function overview(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get("month");
  const month = raw === null ? currentMonth() : parseMonth(raw);
  if (!month) return error("month must be YYYY-MM");
  const tz = config.analyticsTimeZone;
  const s = monthStart(month);
  const e = monthStart(shiftMonth(month, 1));

  // While a month is still in progress, compare it with the same elapsed
  // stretch of the previous month (Nov 1-24 vs Oct 1-24), not a full month.
  const inProgress = formatMonth(month) === formatMonth(currentMonth());
  const prev = shiftMonth(month, -1);
  const prevCutoff = inProgress
    ? sql`LEAST(${monthStart(prev)} + (now() - ${s}), ${s})`
    : undefined;
  const [current, previous] = await Promise.all([periodStats(month), periodStats(prev, prevCutoff)]);

  const [people] = await sql`
    SELECT
      count(*) FILTER (WHERE role = 'customer')::int                          AS customers,
      count(*) FILTER (WHERE role = 'courier')::int                           AS couriers,
      count(*) FILTER (WHERE role = 'courier' AND banned_at IS NULL)::int     AS couriers_active,
      (SELECT count(*) FROM orders WHERE status IN ('placed', 'rejected'))::int  AS awaiting_courier,
      (SELECT count(*) FROM orders WHERE status IN ('recommended', 'accepted'))::int AS in_progress,
      (SELECT count(*) FROM orders o WHERE ${DELIVERED})::int                 AS deliveries_all_time,
      (SELECT COALESCE(sum(price), 0) FROM orders o WHERE ${DELIVERED})::float AS revenue_all_time
    FROM users
  `;

  // One row per calendar day of the month, zero-filled.
  const daily = await sql<{ date: string; deliveries: number; requests: number }[]>`
    WITH days AS (
      SELECT generate_series(
        (${s} AT TIME ZONE ${tz})::date,
        ((${e} AT TIME ZONE ${tz})::date - 1),
        interval '1 day'
      )::date AS day
    ),
    del AS (
      SELECT (o.courier_verified_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM orders o
      WHERE ${DELIVERED} AND o.courier_verified_at >= ${s} AND o.courier_verified_at < ${e}
      GROUP BY 1
    ),
    req AS (
      SELECT (created_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM orders WHERE created_at >= ${s} AND created_at < ${e}
      GROUP BY 1
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
           COALESCE(del.n, 0)::int AS deliveries,
           COALESCE(req.n, 0)::int AS requests
    FROM days
    LEFT JOIN del ON del.day = days.day
    LEFT JOIN req ON req.day = days.day
    ORDER BY days.day
  `;

  // Delivery requests per item category: selected month, all time, and the
  // trailing 12 months ending at the selected month (for the heat grid).
  const from12 = monthStart(shiftMonth(month, -11));
  const catRows = await sql<{ category: string; month_count: number; all_time: number }[]>`
    SELECT item_category AS category,
           count(*) FILTER (WHERE created_at >= ${s} AND created_at < ${e})::int AS month_count,
           count(*)::int AS all_time
    FROM orders GROUP BY item_category
  `;
  const catMonthly = await sql<{ month: string; category: string; n: number }[]>`
    SELECT to_char(created_at AT TIME ZONE ${tz}, 'YYYY-MM') AS month,
           item_category AS category, count(*)::int AS n
    FROM orders WHERE created_at >= ${from12} AND created_at < ${e}
    GROUP BY 1, 2
  `;
  // Configured categories first (stable order), then any legacy ones still in the data.
  const categories = [
    ...ITEM_CATEGORIES,
    ...catRows.map((c) => c.category).filter((c) => !ITEM_CATEGORIES.includes(c)),
  ];
  const byCat = new Map(catRows.map((c) => [c.category, c]));
  const months12 = Array.from({ length: 12 }, (_, i) => formatMonth(shiftMonth(month, i - 11)));

  // Earliest month with any activity, so the month picker has a floor.
  const [first] = await sql`
    SELECT to_char(min(created_at) AT TIME ZONE ${tz}, 'YYYY-MM') AS m FROM orders
  `;

  return json({
    month: formatMonth(month),
    firstMonth: first?.m ?? formatMonth(month),
    currentMonth: formatMonth(currentMonth()),
    timeZone: tz,
    currency: config.pricing.currency,
    totals: {
      customers: people!.customers,
      couriers: people!.couriers,
      couriersActive: people!.couriers_active,
      awaitingCourier: people!.awaiting_courier,
      inProgress: people!.in_progress,
      deliveriesAllTime: people!.deliveries_all_time,
      revenueAllTime: people!.revenue_all_time,
    },
    current,
    previous,
    // True when `previous` covers only the same elapsed part of last month.
    previousIsPartial: inProgress,
    daily,
    categories: {
      months: months12,
      rows: categories.map((category) => ({
        category,
        month: byCat.get(category)?.month_count ?? 0,
        allTime: byCat.get(category)?.all_time ?? 0,
        byMonth: months12.map(
          (mm) => catMonthly.find((r) => r.month === mm && r.category === category)?.n ?? 0,
        ),
      })),
    },
  });
}

// GET /api/admin/analytics/regions?month=YYYY-MM | ?month=all  (admin)
// Pickup requests per municipality, plus each region's boundary as GeoJSON.
export async function regions(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get("month") ?? "all";
  const month = raw === "all" ? null : parseMonth(raw);
  if (raw !== "all" && !month) return error("month must be YYYY-MM or 'all'");

  // Lazily make sure the map has its GTA outlines and older orders have a
  // region. Both are no-ops once done, and bounded otherwise.
  await ensureBaselineRegions();
  await backfillPickupRegions(200);

  const range = month
    ? sql`AND o.created_at >= ${monthStart(month)} AND o.created_at < ${monthStart(shiftMonth(month, 1))}`
    : sql``;

  const rows = await sql<
    {
      id: string;
      name: string;
      county: string | null;
      baseline: boolean;
      geojson: unknown;
      pickups: number;
      delivered: number;
    }[]
  >`
    SELECT r.id, r.name, r.county, r.baseline, r.geojson,
           count(o.id)::int AS pickups,
           count(o.id) FILTER (WHERE ${DELIVERED})::int AS delivered
    FROM regions r
    LEFT JOIN orders o ON o.pickup_region_id = r.id ${range}
    GROUP BY r.id
    HAVING r.baseline OR count(o.id) > 0
    ORDER BY pickups DESC, r.name
  `;
  const [unassigned] = await sql`
    SELECT count(*)::int AS n FROM orders o
    WHERE o.pickup_region_id IS NULL ${range}
  `;

  return json({
    month: month ? formatMonth(month) : "all",
    unassigned: unassigned!.n,
    regions: rows.map((r) => ({
      id: r.id,
      name: r.name,
      county: r.county,
      baseline: r.baseline,
      pickups: r.pickups,
      delivered: r.delivered,
      geojson: r.geojson,
    })),
  });
}
