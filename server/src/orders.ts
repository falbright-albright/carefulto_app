import { sql } from "./db.ts";

// Shape returned to clients. Includes joined customer/courier names.
export interface OrderView {
  id: string;
  status: string;
  itemCategory: string;
  itemDescription: string | null;
  pickupAddress: string;
  dropoffAddress: string;
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
}

const SELECT = sql`
  SELECT o.id, o.status, o.item_category, o.item_description,
         o.pickup_address, o.dropoff_address,
         o.distance_km, o.distance_source, o.price, o.currency,
         o.customer_id, cu.name AS customer_name,
         o.courier_id, co.name AS courier_name,
         o.customer_verified_at, o.courier_verified_at,
         o.created_at, o.updated_at
  FROM orders o
  JOIN users cu ON cu.id = o.customer_id
  LEFT JOIN users co ON co.id = o.courier_id
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toView(r: any): OrderView {
  return {
    id: r.id,
    status: r.status,
    itemCategory: r.item_category,
    itemDescription: r.item_description,
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address,
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
  };
}

export async function getOrder(id: string): Promise<OrderView | null> {
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
