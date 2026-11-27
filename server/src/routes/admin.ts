import { sql } from "../db.ts";
import { json, error, readJson, reqStr } from "../http.ts";
import { hashPassword, type User } from "../auth.ts";
import { getOrder, listOrdersForCourier, listOrdersForCustomer, searchOrders } from "../orders.ts";
import { config } from "../config.ts";
import { formatOrderNumber, parseOrderSearch } from "../orderSearch.ts";
import { notify } from "../notifications.ts";

// GET /api/admin/users  — list all users (admin).
export async function listUsers(): Promise<Response> {
  const users = await sql`
    SELECT id, email, name, role, banned_at, created_at
    FROM users ORDER BY created_at DESC
  `;
  return json({ users });
}

// GET /api/admin/couriers  — non-banned couriers, for recommending orders.
export async function listCouriers(): Promise<Response> {
  const couriers = await sql`
    SELECT id, email, name FROM users
    WHERE role = 'courier' AND banned_at IS NULL
    ORDER BY name
  `;
  return json({ couriers });
}

// POST /api/admin/users  — create a courier or admin account (admin).
export async function createUser(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = reqStr(body.email)?.toLowerCase();
  const name = reqStr(body.name);
  const password = reqStr(body.password);
  const role = reqStr(body.role);
  if (!email || !name || !password || !role) {
    return error("email, name, password and role are required");
  }
  if (role !== "courier" && role !== "admin") {
    return error("role must be 'courier' or 'admin'");
  }
  if (password.length < 8) return error("password must be at least 8 characters");

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) return error("an account with that email already exists", 409);

  const hash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${name}, ${hash}, ${role})
    RETURNING id, email, name, role, banned_at, created_at
  `;
  return json({ user: rows[0] }, 201);
}

// POST /api/admin/users/:id/ban  (admin)
export async function banUser(_req: Request, p: Record<string, string>, admin: User): Promise<Response> {
  const id = p.id!;
  if (id === admin.id) return error("you cannot ban yourself", 400);
  const rows = await sql`SELECT id, role FROM users WHERE id = ${id}`;
  const target = rows[0] as { id: string; role: string } | undefined;
  if (!target) return error("user not found", 404);
  if (target.role === "admin") return error("admins cannot be banned", 400);

  await sql`UPDATE users SET banned_at = now() WHERE id = ${id}`;
  // Revoke active sessions so the ban takes effect immediately.
  await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  return json({ ok: true });
}

// POST /api/admin/users/:id/unban  (admin)
export async function unbanUser(_req: Request, p: Record<string, string>): Promise<Response> {
  const rows = await sql`SELECT id FROM users WHERE id = ${p.id!}`;
  if (rows.length === 0) return error("user not found", 404);
  await sql`UPDATE users SET banned_at = NULL WHERE id = ${p.id!}`;
  return json({ ok: true });
}

// POST /api/orders/:id/recommend  { courierId }  (admin) — recommend to courier.
export async function recommend(req: Request, p: Record<string, string>, admin: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  if (order.status !== "placed" && order.status !== "rejected") {
    return error(`can only recommend orders that are placed or rejected (current: ${order.status})`);
  }
  const body = await readJson(req);
  const courierId = reqStr(body.courierId);
  if (!courierId) return error("courierId is required");

  const courierRows = await sql`
    SELECT id, name FROM users WHERE id = ${courierId} AND role = 'courier' AND banned_at IS NULL
  `;
  const courier = courierRows[0] as { id: string; name: string } | undefined;
  if (!courier) return error("courier not found or is banned", 404);

  await sql`
    UPDATE orders
    SET courier_id = ${courierId}, status = 'recommended', updated_at = now()
    WHERE id = ${order.id}
  `;
  await notify({
    orderId: order.id,
    type: "order_recommended",
    message: `You have been recommended a new delivery (${order.itemCategory}). Accept or reject it.`,
    actorId: admin.id,
    recipientId: courierId,
  });
  return json({ order: await getOrder(order.id) });
}

// GET /api/admin/orders?q=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=N  — searchable, paginated
// order list for the admin Orders table (50 per page, newest first).
export async function searchOrdersRoute(req: Request): Promise<Response> {
  const parsed = parseOrderSearch(new URL(req.url).searchParams);
  if ("error" in parsed) return error(parsed.error);
  return json(await searchOrders(parsed));
}

// Orders that haven't been delivered yet can be cancelled. Once the courier
// reports delivery (completed/verified) it's a refund question, not a cancel.
const CANCELLABLE = ["placed", "recommended", "accepted", "rejected"];
const CANCEL_REASON_MAX = 500;

// POST /api/orders/:id/cancel  (admin) — cancel an order. All of its data is
// kept; it's marked cancelled with who/when/why, and a refund is flagged as
// owed. TODO(refunds): actually paying the refund (and moving refund_status
// to 'refunded') is a future PR.
export async function cancelOrder(req: Request, p: Record<string, string>, admin: User): Promise<Response> {
  const order = await getOrder(p.id!);
  if (!order) return error("order not found", 404);
  const body = await readJson(req);
  const reason = reqStr(body.reason);
  if (reason && reason.length > CANCEL_REASON_MAX) {
    return error(`reason must be at most ${CANCEL_REASON_MAX} characters`);
  }

  // The status check is part of the UPDATE so two admins (or an admin and a
  // courier reporting delivery) can't race past it.
  const updated = await sql`
    UPDATE orders
    SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${admin.id},
        cancel_reason = ${reason}, refund_status = 'pending', updated_at = now()
    WHERE id = ${order.id} AND status = ANY(${CANCELLABLE}::order_status[])
    RETURNING id
  `;
  if (updated.length === 0) {
    return error(
      order.status === "cancelled"
        ? "this order is already cancelled"
        : `a ${order.status} order can't be cancelled — it has already been delivered`,
      409,
    );
  }

  const ref = formatOrderNumber(order.orderNumber);
  const why = reason ? ` Reason: ${reason}` : "";
  await notify({
    orderId: order.id,
    type: "order_cancelled",
    message: `Your order ${ref} (${order.itemCategory}) was cancelled by CarefulTO. Any payment will be refunded.${why}`,
    actorId: admin.id,
    recipientId: order.customerId,
  });
  if (order.courierId) {
    await notify({
      orderId: order.id,
      type: "order_cancelled",
      message: `Order ${ref} (${order.itemCategory}) was cancelled. You no longer need to deliver it.`,
      actorId: admin.id,
      recipientId: order.courierId,
    });
  }
  return json({ order: await getOrder(order.id) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT = 10;

// Delivered = the courier reported it delivered (same rule as Analytics).
const DELIVERED = sql`o.status IN ('completed', 'verified') AND o.courier_verified_at IS NOT NULL`;

// GET /api/admin/users/:id  — one account with role-specific stats (admin).
//   customer: orders placed, by outcome, total spent, recent orders
//   courier:  deliveries, in progress, rejected, cancelled while assigned,
//             earnings this month and all time, recent orders
// "Earnings" is the price of the orders a courier delivered: the courier
// dashboard already shows price as the payout. A real payout split belongs
// to the business-logic PR.
export async function getUser(_req: Request, p: Record<string, string>): Promise<Response> {
  if (!UUID.test(p.id!)) return error("user not found", 404);
  const rows = await sql`
    SELECT id, email, name, role, banned_at, created_at FROM users WHERE id = ${p.id!}
  `;
  const user = rows[0] as
    | { id: string; email: string; name: string; role: string; banned_at: string | null; created_at: string }
    | undefined;
  if (!user) return error("user not found", 404);

  const tz = config.analyticsTimeZone;

  if (user.role === "customer") {
    const [st] = await sql`
      SELECT count(*)::int AS orders,
             count(*) FILTER (WHERE status IN ('placed','recommended','accepted','rejected'))::int AS open,
             count(*) FILTER (WHERE ${DELIVERED})::int AS delivered,
             count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
             COALESCE(sum(price) FILTER (WHERE ${DELIVERED}), 0)::float AS spent,
             max(created_at) AS last_order_at
      FROM orders o WHERE o.customer_id = ${user.id}
    `;
    const recent = (await listOrdersForCustomer(user.id)).slice(0, RECENT);
    return json({
      user,
      customer: {
        orders: st!.orders,
        open: st!.open,
        delivered: st!.delivered,
        cancelled: st!.cancelled,
        spent: st!.spent,
        lastOrderAt: st!.last_order_at,
        currency: config.pricing.currency,
      },
      recentOrders: recent,
    });
  }

  if (user.role === "courier") {
    const [st] = await sql`
      SELECT
        count(*) FILTER (WHERE ${DELIVERED})::int AS delivered,
        count(*) FILTER (WHERE o.status = 'accepted')::int AS in_progress,
        count(*) FILTER (WHERE o.status = 'recommended')::int AS awaiting_reply,
        count(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_while_assigned,
        COALESCE(sum(o.price) FILTER (WHERE ${DELIVERED}), 0)::float AS earnings_all_time,
        COALESCE(sum(o.price) FILTER (
          WHERE ${DELIVERED}
            AND to_char(o.courier_verified_at AT TIME ZONE ${tz}, 'YYYY-MM')
              = to_char(now() AT TIME ZONE ${tz}, 'YYYY-MM')
        ), 0)::float AS earnings_this_month,
        count(*) FILTER (
          WHERE ${DELIVERED}
            AND to_char(o.courier_verified_at AT TIME ZONE ${tz}, 'YYYY-MM')
              = to_char(now() AT TIME ZONE ${tz}, 'YYYY-MM')
        )::int AS delivered_this_month
      FROM orders o WHERE o.courier_id = ${user.id}
    `;
    // A reject clears the order's courier, so rejections are counted from
    // the order history (one event per admin notified -> distinct orders).
    const [rej] = await sql`
      SELECT count(DISTINCT order_id)::int AS n
      FROM order_events WHERE type = 'order_rejected' AND actor_id = ${user.id}
    `;
    const recent = (await listOrdersForCourier(user.id)).slice(0, RECENT);
    return json({
      user,
      courier: {
        delivered: st!.delivered,
        deliveredThisMonth: st!.delivered_this_month,
        inProgress: st!.in_progress,
        awaitingReply: st!.awaiting_reply,
        rejected: rej!.n,
        cancelledWhileAssigned: st!.cancelled_while_assigned,
        earningsThisMonth: st!.earnings_this_month,
        earningsAllTime: st!.earnings_all_time,
        currency: config.pricing.currency,
      },
      recentOrders: recent,
    });
  }

  return json({ user, recentOrders: [] });
}
