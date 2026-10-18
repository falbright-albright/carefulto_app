import { sql } from "../db.ts";
import { json, error, readJson, reqStr } from "../http.ts";
import type { User } from "../auth.ts";
import { isValidCategory } from "../categories.ts";
import { distanceProvider, DistanceUnavailableError, type GeoPoint } from "../distance.ts";
import { priceForDistance } from "../pricing.ts";
import { config } from "../config.ts";
import {
  getOrder,
  listAllOrders,
  listOrdersForCourier,
  listOrdersForCustomer,
} from "../orders.ts";
import { notify, notifyAdmins } from "../notifications.ts";

interface QuoteResult {
  distanceKm: number;
  price: number;
  currency: string;
  source: string;
  pickup?: GeoPoint;
  dropoff?: GeoPoint;
}

// Compute a distance + price quote. Uses a manual km if provided, otherwise
// OpenRouteService. Returns needsManual=true (422) when automatic fails.
async function computeQuote(
  pickupAddress: string,
  dropoffAddress: string,
  manualKm: number | null,
): Promise<QuoteResult | { needsManual: true; reason: string }> {
  if (manualKm !== null) {
    if (!(manualKm > 0) || manualKm > 5000) {
      throw new Error("manual distance must be between 0 and 5000 km");
    }
    const km = Math.round(manualKm * 100) / 100;
    return {
      distanceKm: km,
      price: priceForDistance(km),
      currency: config.pricing.currency,
      source: "manual",
    };
  }

  try {
    const r = await distanceProvider.quote(pickupAddress, dropoffAddress);
    return {
      distanceKm: r.distanceKm,
      price: priceForDistance(r.distanceKm),
      currency: config.pricing.currency,
      source: r.source,
      pickup: r.pickup,
      dropoff: r.dropoff,
    };
  } catch (err) {
    if (err instanceof DistanceUnavailableError) {
      return { needsManual: true, reason: err.message };
    }
    throw err;
  }
}

// POST /api/orders/quote  (customer)
export async function quote(req: Request): Promise<Response> {
  const body = await readJson(req);
  const pickup = reqStr(body.pickupAddress);
  const dropoff = reqStr(body.dropoffAddress);
  const manualKm = typeof body.manualKm === "number" ? body.manualKm : null;
  if (!pickup || !dropoff) return error("pickupAddress and dropoffAddress are required");

  try {
    const q = await computeQuote(pickup, dropoff, manualKm);
    if ("needsManual" in q) return json(q, 422);
    return json(q);
  } catch (err) {
    return error(err instanceof Error ? err.message : "could not compute quote", 400);
  }
}

// POST /api/orders  (customer) — place an order.
export async function create(req: Request, _p: Record<string, string>, user: User): Promise<Response> {
  const body = await readJson(req);
  const itemCategory = reqStr(body.itemCategory);
  const itemDescription = reqStr(body.itemDescription); // optional
  const pickup = reqStr(body.pickupAddress);
  const dropoff = reqStr(body.dropoffAddress);
  const manualKm = typeof body.manualKm === "number" ? body.manualKm : null;

  if (!itemCategory || !pickup || !dropoff) {
    return error("itemCategory, pickupAddress and dropoffAddress are required");
  }
  if (!isValidCategory(itemCategory)) return error("unknown item category");

  let q;
  try {
    q = await computeQuote(pickup, dropoff, manualKm);
  } catch (err) {
    return error(err instanceof Error ? err.message : "could not compute quote", 400);
  }
  if ("needsManual" in q) {
    return json({ ...q, error: "distance unavailable; provide manualKm" }, 422);
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO orders (
      customer_id, item_category, item_description,
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      distance_km, distance_source, price, currency, status
    ) VALUES (
      ${user.id}, ${itemCategory}, ${itemDescription},
      ${pickup}, ${q.pickup?.lat ?? null}, ${q.pickup?.lng ?? null},
      ${dropoff}, ${q.dropoff?.lat ?? null}, ${q.dropoff?.lng ?? null},
      ${q.distanceKm}, ${q.source}, ${q.price}, ${q.currency}, 'placed'
    )
    RETURNING id
  `;
  const orderId = rows[0]!.id;

  await notifyAdmins({
    orderId,
    type: "order_placed",
    message: `New order placed by ${user.name} (${itemCategory}).`,
    actorId: user.id,
  });

  const order = await getOrder(orderId);
  return json({ order }, 201);
}

// GET /api/orders  — role-scoped list.
export async function list(_req: Request, _p: Record<string, string>, user: User): Promise<Response> {
  let orders;
  if (user.role === "admin") orders = await listAllOrders();
  else if (user.role === "courier") orders = await listOrdersForCourier(user.id);
  else orders = await listOrdersForCustomer(user.id);
  return json({ orders });
}

// GET /api/orders/:id  — role-scoped single order.
export async function getOne(_req: Request, p: Record<string, string>, user: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  const allowed =
    user.role === "admin" ||
    order.customerId === user.id ||
    order.courierId === user.id;
  if (!allowed) return error("forbidden", 403);
  return json({ order });
}

// POST /api/orders/:id/complete  (courier) — report the delivery completed.
// The courier's completion report counts as the courier's verification.
export async function complete(_req: Request, p: Record<string, string>, user: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.courierId !== user.id) return error("you are not assigned to this order", 403);
  if (order.status !== "accepted") return error(`cannot complete an order in status "${order.status}"`);

  await sql`
    UPDATE orders
    SET status = 'completed', courier_verified_at = now(), updated_at = now()
    WHERE id = ${order.id}
  `;
  await notify({
    orderId: order.id,
    type: "order_completed",
    message: `Your courier reported order delivered. Please verify completion.`,
    actorId: user.id,
    recipientId: order.customerId,
  });
  return json({ order: await getOrder(order.id) });
}

// POST /api/orders/:id/verify  (customer) — verify the delivery completed.
// When both customer and courier have verified, the order is finalized and
// admins are notified.
export async function verify(_req: Request, p: Record<string, string>, user: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.customerId !== user.id) return error("only the customer can verify this order", 403);
  if (order.status !== "completed") {
    return error(`cannot verify an order in status "${order.status}"`);
  }

  await sql`
    UPDATE orders
    SET customer_verified_at = now(), updated_at = now()
    WHERE id = ${order.id}
  `;

  const updated = await getOrder(order.id);
  // Both verified -> finalize.
  if (updated && updated.customerVerifiedAt && updated.courierVerifiedAt) {
    await sql`UPDATE orders SET status = 'verified', updated_at = now() WHERE id = ${order.id}`;
    await notifyAdmins({
      orderId: order.id,
      type: "order_verified",
      message: `Order fully verified by customer and courier. Delivery confirmed complete.`,
      actorId: user.id,
    });
    if (updated.courierId) {
      await notify({
        orderId: order.id,
        type: "order_verified",
        message: `Customer verified the delivery. Order is now complete.`,
        actorId: user.id,
        recipientId: updated.courierId,
      });
    }
  }
  return json({ order: await getOrder(order.id) });
}
