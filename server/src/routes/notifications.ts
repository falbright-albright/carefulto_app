import { sql } from "../db.ts";
import { json } from "../http.ts";
import type { User } from "../auth.ts";

// GET /api/notifications  — the current user's notification feed.
export async function list(_req: Request, _p: Record<string, string>, user: User): Promise<Response> {
  const notifications = await sql`
    SELECT id, order_id, type, message, read_at, created_at
    FROM order_events
    WHERE recipient_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const unread = notifications.filter((n) => !n.read_at).length;
  return json({ notifications, unread });
}

// POST /api/notifications/read  — mark all as read.
export async function markAllRead(_req: Request, _p: Record<string, string>, user: User): Promise<Response> {
  await sql`
    UPDATE order_events SET read_at = now()
    WHERE recipient_id = ${user.id} AND read_at IS NULL
  `;
  return json({ ok: true });
}
