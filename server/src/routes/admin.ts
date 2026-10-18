import { sql } from "../db.ts";
import { json, error, readJson, reqStr } from "../http.ts";
import { hashPassword, type User } from "../auth.ts";
import { getOrder } from "../orders.ts";
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
