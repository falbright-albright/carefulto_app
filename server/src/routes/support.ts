import { sql } from "../db.ts";
import { json, error, readJson } from "../http.ts";
import type { User } from "../auth.ts";
import { notify, notifyAdmins } from "../notifications.ts";
import { formatOrderNumber } from "../orderSearch.ts";
import {
  countActiveRequests,
  formatRequestRef,
  getRequest,
  isKind,
  isStatus,
  isUuid,
  KIND_LABEL,
  listMessages,
  listRequestsForAdmin,
  listRequestsForCustomer,
  parseMessage,
  parseNewRequest,
  redactForCustomer,
  STATUS_LABEL,
  type AdminRequestFilter,
  type SupportRequestView,
} from "../support.ts";

// "Contact us": customers open requests (complaints, questions, comments) and
// talk them through with admins. Couriers have no access to any of this.

// Loads a request the user may see: admins see all, customers their own.
async function loadVisible(
  id: string | undefined,
  user: User,
): Promise<SupportRequestView | Response> {
  if (!isUuid(id)) return error("request not found", 404);
  const request = await getRequest(id);
  if (!request) return error("request not found", 404);
  if (user.role !== "admin" && request.customerId !== user.id) return error("forbidden", 403);
  return request;
}

async function detail(request: SupportRequestView, user: User): Promise<Response> {
  const messages = await listMessages(request.id);
  return json({
    request,
    messages: user.role === "admin" ? messages : redactForCustomer(messages),
  });
}

// POST /api/support/requests  (customer)
export async function create(
  req: Request,
  _p: Record<string, string>,
  user: User,
): Promise<Response> {
  const parsed = parseNewRequest(await readJson(req));
  if ("error" in parsed) return error(parsed.error);

  // The order must be the customer's own. A courier complaint is filed
  // against the courier assigned to that order right now.
  let courierId: string | null = null;
  let orderRef: string | null = null;
  if (parsed.orderId) {
    const [order] = await sql<
      { customer_id: string; courier_id: string | null; order_number: number }[]
    >`SELECT customer_id, courier_id, order_number FROM orders WHERE id = ${parsed.orderId}`;
    if (!order || order.customer_id !== user.id) return error("order not found", 404);
    courierId = order.courier_id;
    orderRef = formatOrderNumber(order.order_number);
    if (parsed.kind === "courier" && !courierId) {
      return error("no courier has been assigned to this order yet");
    }
  }

  const created = await sql.begin(async (tx) => {
    const [r] = await tx<{ id: string; ref_number: number }[]>`
      INSERT INTO support_requests (customer_id, kind, order_id, courier_id, subject)
      VALUES (${user.id}, ${parsed.kind}, ${parsed.orderId}, ${courierId}, ${parsed.subject})
      RETURNING id, ref_number
    `;
    await tx`
      INSERT INTO support_messages (request_id, author_id, body)
      VALUES (${r!.id}, ${user.id}, ${parsed.message})
    `;
    return r!;
  });

  const ref = formatRequestRef(created.ref_number);
  const about = orderRef ? ` about order ${orderRef}` : "";
  await notifyAdmins({
    supportRequestId: created.id,
    type: "support_request_created",
    message: `New ${KIND_LABEL[parsed.kind].toLowerCase()} ${ref}${about} from ${user.name}: “${parsed.subject}”`,
    actorId: user.id,
  });

  const request = await getRequest(created.id);
  return json({ request }, 201);
}

// GET /api/support/requests  — customers: their own; admins: filtered inbox.
//   ?status=active|open|in_review|resolved|all   (admin, default active)
//   ?kind=delivery|courier|question|comment|all  (admin, default all)
export async function list(
  req: Request,
  _p: Record<string, string>,
  user: User,
): Promise<Response> {
  if (user.role !== "admin") {
    return json({ requests: await listRequestsForCustomer(user.id) });
  }
  const url = new URL(req.url);
  const s = url.searchParams.get("status") ?? "active";
  const k = url.searchParams.get("kind") ?? "all";
  if (!(s === "active" || s === "all" || isStatus(s))) return error("unknown status filter");
  if (!(k === "all" || isKind(k))) return error("unknown kind filter");
  const filter: AdminRequestFilter = { status: s, kind: k };
  const [requests, active] = await Promise.all([
    listRequestsForAdmin(filter),
    countActiveRequests(),
  ]);
  return json({ requests, active });
}

// GET /api/support/requests/:id  — the request and its conversation.
export async function getOne(
  _req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const request = await loadVisible(p.id, user);
  if (request instanceof Response) return request;
  return detail(request, user);
}

// POST /api/support/requests/:id/messages  — reply in the conversation.
// An admin's reply moves an open request to "in review"; a customer's reply
// sends it back to "open" (waiting on us), reopening it if it was resolved.
export async function reply(
  req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const request = await loadVisible(p.id, user);
  if (request instanceof Response) return request;
  const msg = parseMessage((await readJson(req)).message);
  if ("error" in msg) return error(msg.error);

  const isAdmin = user.role === "admin";
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO support_messages (request_id, author_id, body)
      VALUES (${request.id}, ${user.id}, ${msg.body})
    `;
    if (isAdmin) {
      await tx`
        UPDATE support_requests
        SET status = CASE WHEN status = 'open' THEN 'in_review' ELSE status END,
            updated_at = now()
        WHERE id = ${request.id}
      `;
    } else {
      await tx`
        UPDATE support_requests
        SET status = 'open', resolved_at = NULL, updated_at = now()
        WHERE id = ${request.id}
      `;
    }
  });

  if (isAdmin) {
    await notify({
      supportRequestId: request.id,
      type: "support_reply",
      message: `CarefulTO Support replied to your request ${request.ref}: “${request.subject}”`,
      actorId: user.id,
      recipientId: request.customerId,
    });
  } else {
    const reopened = request.status === "resolved" ? " and reopened it" : "";
    await notifyAdmins({
      supportRequestId: request.id,
      type: "support_customer_reply",
      message: `${user.name} replied to ${request.ref}${reopened}: “${request.subject}”`,
      actorId: user.id,
    });
  }

  return detail((await getRequest(request.id))!, user);
}

// POST /api/support/requests/:id/status  (admin) — { status }.
export async function setStatus(
  req: Request,
  p: Record<string, string>,
  user: User,
): Promise<Response> {
  const request = await loadVisible(p.id, user);
  if (request instanceof Response) return request;
  const status = (await readJson(req)).status;
  if (!isStatus(status)) return error("status must be open, in_review or resolved");
  if (status === request.status) return detail(request, user);

  await sql`
    UPDATE support_requests
    SET status = ${status},
        resolved_at = ${status === "resolved" ? sql`now()` : null},
        updated_at = now()
    WHERE id = ${request.id}
  `;
  // The customer hears about resolving and reopening; "in review" is internal.
  if (status === "resolved" || request.status === "resolved") {
    await notify({
      supportRequestId: request.id,
      type: "support_status",
      message: `Your request ${request.ref} was marked ${STATUS_LABEL[status].toLowerCase()}: “${request.subject}”`,
      actorId: user.id,
      recipientId: request.customerId,
    });
  }
  return detail((await getRequest(request.id))!, user);
}
