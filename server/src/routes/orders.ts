import { sql } from "../db.ts";
import { json, error, readJson, reqStr } from "../http.ts";
import type { User } from "../auth.ts";
import { isValidCategory } from "../categories.ts";
import { route, RouteUnavailableError, withinOntario, type RoutePoint } from "../routing.ts";
import { priceForDistance } from "../pricing.ts";
import { formatOrderNumber } from "../orderSearch.ts";
import { config } from "../config.ts";
import {
  changedMeanwhile,
  getOrder,
  listAllOrders,
  listOrdersForCourier,
  listOrdersForCustomer,
} from "../orders.ts";
import { notify, notifyAdmins } from "../notifications.ts";
import { assignPickupRegion } from "../regions.ts";

const NOTES_MAX = 2000;

interface QuoteResult {
  distanceKm: number;
  durationMin: number;
  price: number;
  currency: string;
  source: "osrm";
  geometry: [number, number][];
}

// Reads `${prefix}Lat` / `${prefix}Lng` from the body. These are the
// coordinates of the address suggestion the customer picked — the price is
// computed from these pins, never by re-geocoding the address text.
function readPoint(body: Record<string, unknown>, prefix: "pickup" | "dropoff"): RoutePoint | null {
  const lat = body[`${prefix}Lat`];
  const lng = body[`${prefix}Lng`];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

type PointsResult = { pickup: RoutePoint; dropoff: RoutePoint } | { error: Response };

function readPoints(body: Record<string, unknown>): PointsResult {
  const pickup = readPoint(body, "pickup");
  const dropoff = readPoint(body, "dropoff");
  if (!pickup || !dropoff) {
    return {
      error: error(
        "pickupLat, pickupLng, dropoffLat and dropoffLng are required — select both addresses from the suggestions",
      ),
    };
  }
  if (!withinOntario(pickup) || !withinOntario(dropoff)) {
    return { error: error("pickup and delivery must both be within Ontario") };
  }
  return { pickup, dropoff };
}

// Driving distance between the two pins via the self-hosted OSRM, priced
// with priceForDistance. Throws RouteUnavailableError if OSRM can't route.
async function computeQuote(pickup: RoutePoint, dropoff: RoutePoint): Promise<QuoteResult> {
  const r = await route(pickup, dropoff);
  return {
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    price: priceForDistance(r.distanceKm),
    currency: config.pricing.currency,
    source: "osrm",
    geometry: r.geometry,
  };
}

const PRICE_UNAVAILABLE =
  "We couldn't calculate a price for these addresses right now. Please try again in a moment.";

// POST /api/orders/quote  (customer)
export async function quote(req: Request): Promise<Response> {
  const body = await readJson(req);
  const points = readPoints(body);
  if ("error" in points) return points.error;

  try {
    return json(await computeQuote(points.pickup, points.dropoff));
  } catch (err) {
    if (err instanceof RouteUnavailableError) return error(PRICE_UNAVAILABLE, 502);
    throw err;
  }
}

// POST /api/orders  (customer) — place an order. The price is recomputed
// server-side from the pins; any client-sent price is ignored.
export async function create(
  req: Request,
  _p: Record<string, string>,
  user: User,
): Promise<Response> {
  const body = await readJson(req);
  const itemCategory = reqStr(body.itemCategory);
  const itemDescription = reqStr(body.itemDescription); // optional
  const notes = reqStr(body.notes); // optional
  const pickup = reqStr(body.pickupAddress);
  const dropoff = reqStr(body.dropoffAddress);

  if (!itemCategory || !pickup || !dropoff) {
    return error("itemCategory, pickupAddress and dropoffAddress are required");
  }
  if (!isValidCategory(itemCategory)) return error("unknown item category");
  if (notes && notes.length > NOTES_MAX) {
    return error(`notes must be at most ${NOTES_MAX} characters`);
  }
  const points = readPoints(body);
  if ("error" in points) return points.error;

  let q: QuoteResult;
  try {
    q = await computeQuote(points.pickup, points.dropoff);
  } catch (err) {
    if (err instanceof RouteUnavailableError) return error(PRICE_UNAVAILABLE, 502);
    throw err;
  }

  const rows = await sql<{ id: string; order_number: number }[]>`
    INSERT INTO orders (
      customer_id, item_category, item_description, notes,
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      distance_km, distance_source, price, currency, status
    ) VALUES (
      ${user.id}, ${itemCategory}, ${itemDescription}, ${notes},
      ${pickup}, ${points.pickup.lat}, ${points.pickup.lng},
      ${dropoff}, ${points.dropoff.lat}, ${points.dropoff.lng},
      ${q.distanceKm}, ${q.source}, ${q.price}, ${q.currency}, 'placed'
    )
    RETURNING id, order_number
  `;
  const orderId = rows[0]!.id;
  const ref = formatOrderNumber(rows[0]!.order_number);
  // Tag the pickup's municipality for analytics. Fire-and-forget: it never
  // throws and must not delay or fail order placement.
  void assignPickupRegion(orderId, points.pickup.lat, points.pickup.lng);

  await notifyAdmins({
    orderId,
    type: "order_placed",
    message: `New order ${ref} placed by ${user.name} (${itemCategory}).`,
    actorId: user.id,
  });

  const order = await getOrder(orderId);
  return json({ order }, 201);
}

// GET /api/orders  — role-scoped list.
export async function list(
  _req: Request,
  _p: Record<string, string>,
  user: User,
): Promise<Response> {
  let orders;
  if (user.role === "admin") orders = await listAllOrders();
  else if (user.role === "courier") orders = await listOrdersForCourier(user.id);
  else orders = await listOrdersForCustomer(user.id);
  return json({ orders });
}

// GET /api/orders/:id  — role-scoped single order.
export async function getOne(
  _req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  const allowed =
    user.role === "admin" || order.customerId === user.id || order.courierId === user.id;
  if (!allowed) return error("forbidden", 403);
  return json({ order });
}

// POST /api/orders/:id/complete  (courier) — report the delivery completed.
// The courier's completion report counts as the courier's verification.
export async function complete(
  _req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.courierId !== user.id) return error("you are not assigned to this order", 403);
  if (order.status !== "accepted")
    return error(`cannot complete an order in status "${order.status}"`);

  const done = await sql`
    UPDATE orders
    SET status = 'completed', courier_verified_at = now(), updated_at = now()
    WHERE id = ${order.id} AND status = 'accepted' AND courier_id = ${user.id}
    RETURNING id
  `;
  if (done.length === 0) return changedMeanwhile(order.id);
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
export async function verify(
  _req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.customerId !== user.id) return error("only the customer can verify this order", 403);
  if (order.status !== "completed") {
    return error(`cannot verify an order in status "${order.status}"`);
  }

  const marked = await sql`
    UPDATE orders
    SET customer_verified_at = now(), updated_at = now()
    WHERE id = ${order.id} AND status = 'completed'
    RETURNING id
  `;
  if (marked.length === 0) return changedMeanwhile(order.id);

  // Both verified -> finalize. Guarded so only one request finalizes (and
  // notifies), even if the customer double-submits.
  const finalized = await sql<{ courier_id: string | null }[]>`
    UPDATE orders SET status = 'verified', updated_at = now()
    WHERE id = ${order.id} AND status = 'completed'
      AND customer_verified_at IS NOT NULL AND courier_verified_at IS NOT NULL
    RETURNING courier_id
  `;
  const fin = finalized[0];
  if (fin) {
    await notifyAdmins({
      orderId: order.id,
      type: "order_verified",
      message: `Order fully verified by customer and courier. Delivery confirmed complete.`,
      actorId: user.id,
    });
    if (fin.courier_id) {
      await notify({
        orderId: order.id,
        type: "order_verified",
        message: `Customer verified the delivery. Order is now complete.`,
        actorId: user.id,
        recipientId: fin.courier_id,
      });
    }
  }
  return json({ order: await getOrder(order.id) });
}
