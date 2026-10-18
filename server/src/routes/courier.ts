import { sql } from "../db.ts";
import { json, error } from "../http.ts";
import type { User } from "../auth.ts";
import { getOrder } from "../orders.ts";
import { notify, notifyAdmins } from "../notifications.ts";

// POST /api/orders/:id/accept  (courier)
export async function accept(_req: Request, p: Record<string, string>, user: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.courierId !== user.id) return error("this order was not recommended to you", 403);
  if (order.status !== "recommended") {
    return error(`cannot accept an order in status "${order.status}"`);
  }

  await sql`UPDATE orders SET status = 'accepted', updated_at = now() WHERE id = ${order.id}`;
  await notify({
    orderId: order.id,
    type: "order_accepted",
    message: `Your courier ${user.name} accepted the order and will deliver it.`,
    actorId: user.id,
    recipientId: order.customerId,
  });
  await notifyAdmins({
    orderId: order.id,
    type: "order_accepted",
    message: `Courier ${user.name} accepted the order.`,
    actorId: user.id,
  });
  return json({ order: await getOrder(order.id) });
}

// POST /api/orders/:id/reject  (courier) — returns the order to the admin queue.
export async function reject(_req: Request, p: Record<string, string>, user: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.courierId !== user.id) return error("this order was not recommended to you", 403);
  if (order.status !== "recommended") {
    return error(`cannot reject an order in status "${order.status}"`);
  }

  // Clear the courier and send it back to the queue (status 'placed' so the
  // admin can recommend it again to someone else).
  await sql`
    UPDATE orders SET courier_id = NULL, status = 'placed', updated_at = now()
    WHERE id = ${order.id}
  `;
  await notifyAdmins({
    orderId: order.id,
    type: "order_rejected",
    message: `Courier ${user.name} rejected the order. It is back in the queue.`,
    actorId: user.id,
  });
  return json({ order: await getOrder(order.id) });
}
