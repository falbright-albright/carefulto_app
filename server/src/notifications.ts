import { sql } from "./db.ts";

// Records an event that also surfaces as an in-app notification for the
// recipient. It belongs to an order or to a support request (supportRequestId);
// actorId/recipientId may be null (e.g. system or broadcast).
export async function notify(params: {
  orderId?: string | null;
  supportRequestId?: string | null;
  type: string;
  message: string;
  actorId?: string | null;
  recipientId?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO order_events (order_id, support_request_id, actor_id, recipient_id, type, message)
    VALUES (
      ${params.orderId ?? null},
      ${params.supportRequestId ?? null},
      ${params.actorId ?? null},
      ${params.recipientId ?? null},
      ${params.type},
      ${params.message}
    )
  `;
}

// Notify every admin (used when an order is fully verified, or newly placed).
export async function notifyAdmins(params: {
  orderId?: string | null;
  supportRequestId?: string | null;
  type: string;
  message: string;
  actorId?: string | null;
}): Promise<void> {
  const admins = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'admin' AND banned_at IS NULL
  `;
  for (const a of admins) {
    await notify({ ...params, recipientId: a.id });
  }
}
