import { config } from "./config.ts";
import { sql } from "./db.ts";
import { ORDER_PAGE_SIZE, type OrderSearch } from "./orderSearch.ts";

// Shape returned to clients. Includes joined customer/courier names.
export interface OrderView {
  id: string;
  orderNumber: number;
  status: string;
  itemCategory: string;
  itemDescription: string | null;
  notes: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  // Map pins the customer selected (null on old orders placed before pins).
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm: number;
  distanceSource: string;
  price: number;
  currency: string;
  customerId: string;
  customerName: string;
  courierId: string | null;
  courierName: string | null;
  customerVerifiedAt: string | null;
  courierVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  refundStatus: "pending" | "refunded" | null;
}

const SELECT = sql`
  SELECT o.id, o.order_number, o.status, o.item_category, o.item_description, o.notes,
         o.pickup_address, o.dropoff_address,
         o.pickup_lat, o.pickup_lng, o.dropoff_lat, o.dropoff_lng,
         o.distance_km, o.distance_source, o.price, o.currency,
         o.customer_id, cu.name AS customer_name,
         o.courier_id, co.name AS courier_name,
         o.customer_verified_at, o.courier_verified_at,
         o.created_at, o.updated_at,
         o.cancelled_at, ca.name AS cancelled_by_name, o.cancel_reason, o.refund_status
  FROM orders o
  JOIN users cu ON cu.id = o.customer_id
  LEFT JOIN users co ON co.id = o.courier_id
  LEFT JOIN users ca ON ca.id = o.cancelled_by
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toView(r: any): OrderView {
  return {
    id: r.id,
    orderNumber: Number(r.order_number),
    status: r.status,
    itemCategory: r.item_category,
    itemDescription: r.item_description,
    notes: r.notes,
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address,
    pickupLat: r.pickup_lat === null ? null : Number(r.pickup_lat),
    pickupLng: r.pickup_lng === null ? null : Number(r.pickup_lng),
    dropoffLat: r.dropoff_lat === null ? null : Number(r.dropoff_lat),
    dropoffLng: r.dropoff_lng === null ? null : Number(r.dropoff_lng),
    distanceKm: Number(r.distance_km),
    distanceSource: r.distance_source,
    price: Number(r.price),
    currency: r.currency,
    customerId: r.customer_id,
    customerName: r.customer_name,
    courierId: r.courier_id,
    courierName: r.courier_name,
    customerVerifiedAt: r.customer_verified_at,
    courierVerifiedAt: r.courier_verified_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cancelledAt: r.cancelled_at,
    cancelledByName: r.cancelled_by_name,
    cancelReason: r.cancel_reason,
    refundStatus: r.refund_status,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrder(id: string): Promise<OrderView | null> {
  // A malformed id can't match any order; checking here turns what used to
  // be a Postgres "invalid uuid" 500 into a clean 404 for callers.
  if (!UUID.test(id)) return null;
  const rows = await sql`${SELECT} WHERE o.id = ${id}`;
  return rows[0] ? toView(rows[0]) : null;
}

export async function listOrdersForCustomer(customerId: string): Promise<OrderView[]> {
  const rows = await sql`${SELECT} WHERE o.customer_id = ${customerId} ORDER BY o.created_at DESC`;
  return rows.map(toView);
}

export async function listOrdersForCourier(courierId: string): Promise<OrderView[]> {
  const rows = await sql`${SELECT} WHERE o.courier_id = ${courierId} ORDER BY o.created_at DESC`;
  return rows.map(toView);
}

export async function listAllOrders(): Promise<OrderView[]> {
  const rows = await sql`${SELECT} ORDER BY o.created_at DESC`;
  return rows.map(toView);
}

export interface OrderPage {
  orders: OrderView[];
  total: number; // matches across all pages
  page: number;
  pageSize: number;
  pageCount: number;
}

// Admin order search: every term must appear in the order's searchable
// text (see OrderSearch), optionally limited to a placed-date range
// (inclusive), newest first,
// ORDER_PAGE_SIZE per page.
export async function searchOrders({ terms, from, to, page }: OrderSearch): Promise<OrderPage> {
  const tz = config.analyticsTimeZone;
  const where = sql`
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(${terms}::text[]) AS t(term)
      WHERE concat_ws(' ',
        'CT-' || o.order_number, cu.name, cu.email,
        o.pickup_address, o.dropoff_address, co.name,
        o.item_category, o.status, o.price::text,
        to_char(o.created_at AT TIME ZONE ${tz}, 'YYYY-MM-DD FMMonth FMMon FMDD')
      ) NOT ILIKE '%' || t.term || '%'
    )
    AND (${from}::date IS NULL OR (o.created_at AT TIME ZONE ${tz})::date >= ${from}::date)
    AND (${to}::date IS NULL OR (o.created_at AT TIME ZONE ${tz})::date <= ${to}::date)
  `;
  const [rows, counted] = await Promise.all([
    sql`
      ${SELECT} ${where}
      ORDER BY o.created_at DESC, o.order_number DESC
      LIMIT ${ORDER_PAGE_SIZE} OFFSET ${(page - 1) * ORDER_PAGE_SIZE}
    `,
    sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM orders o
      JOIN users cu ON cu.id = o.customer_id
      LEFT JOIN users co ON co.id = o.courier_id
      ${where}
    `,
  ]);
  const total = counted[0]?.n ?? 0;
  return {
    orders: rows.map(toView),
    total,
    page,
    pageSize: ORDER_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)),
  };
}
