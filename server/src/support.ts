import { sql } from "./db.ts";

// Customer support requests ("Contact us"): types, input validation and the
// queries shared by the support routes. See db/schema.sql for the lifecycle.

export const SUPPORT_KINDS = ["delivery", "courier", "question", "comment"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export const SUPPORT_STATUSES = ["open", "in_review", "resolved"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 4000;

// Kinds that must name one of the customer's orders.
export const ORDER_KINDS: readonly SupportKind[] = ["delivery", "courier"];

// 1001 -> "RQ-1001": the reference customers quote (orders use CT-).
export function formatRequestRef(n: number): string {
  return `RQ-${n}`;
}

export const KIND_LABEL: Record<SupportKind, string> = {
  delivery: "Problem with a delivery",
  courier: "Problem with a courier",
  question: "Question",
  comment: "Comment",
};

export const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
};

export function isKind(v: unknown): v is SupportKind {
  return typeof v === "string" && (SUPPORT_KINDS as readonly string[]).includes(v);
}

export function isStatus(v: unknown): v is SupportStatus {
  return typeof v === "string" && (SUPPORT_STATUSES as readonly string[]).includes(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Validates a message body (a new request's first message, or a reply).
export function parseMessage(v: unknown): { body: string } | { error: string } {
  const body = text(v);
  if (!body) return { error: "message is required" };
  if (body.length > MESSAGE_MAX)
    return { error: `message must be at most ${MESSAGE_MAX} characters` };
  return { body };
}

export interface NewRequest {
  kind: SupportKind;
  orderId: string | null;
  subject: string;
  message: string;
}

// Validates the body of POST /api/support/requests. Ownership of the order
// (and whether it has a courier) is checked against the database afterwards.
export function parseNewRequest(body: Record<string, unknown>): NewRequest | { error: string } {
  if (!isKind(body.kind)) {
    return { error: `kind must be one of: ${SUPPORT_KINDS.join(", ")}` };
  }
  const kind = body.kind;

  let orderId: string | null = null;
  if (body.orderId !== undefined && body.orderId !== null && body.orderId !== "") {
    if (!isUuid(body.orderId)) return { error: "orderId is not a valid order" };
    orderId = body.orderId;
  }
  if (ORDER_KINDS.includes(kind) && !orderId) {
    return { error: "choose the order this is about" };
  }

  const subject = text(body.subject);
  if (!subject) return { error: "subject is required" };
  if (subject.length > SUBJECT_MAX) {
    return { error: `subject must be at most ${SUBJECT_MAX} characters` };
  }

  const msg = parseMessage(body.message);
  if ("error" in msg) return msg;

  return { kind, orderId, subject, message: msg.body };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface SupportRequestView {
  id: string;
  ref: string;
  kind: SupportKind;
  status: SupportStatus;
  subject: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  orderNumber: number | null;
  courierId: string | null;
  courierName: string | null;
  messageCount: number;
  // Who wrote the latest message: lets admins see which requests await them.
  lastAuthorRole: "customer" | "admin" | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SupportMessageView {
  id: string;
  authorId: string;
  authorName: string;
  // Customers see "CarefulTO Support" for every admin reply; see redactFor.
  authorRole: "customer" | "admin";
  body: string;
  createdAt: string;
}

const SELECT = sql`
  SELECT r.id, r.ref_number, r.kind, r.status, r.subject,
         r.customer_id, cu.name AS customer_name,
         r.order_id, o.order_number,
         r.courier_id, co.name AS courier_name,
         r.created_at, r.updated_at, r.resolved_at,
         (SELECT count(*)::int FROM support_messages m WHERE m.request_id = r.id) AS message_count,
         last.role AS last_author_role, last.created_at AS last_message_at
  FROM support_requests r
  JOIN users cu ON cu.id = r.customer_id
  LEFT JOIN orders o ON o.id = r.order_id
  LEFT JOIN users co ON co.id = r.courier_id
  LEFT JOIN LATERAL (
    SELECT CASE WHEN u.role = 'admin' THEN 'admin' ELSE 'customer' END AS role, m.created_at
    FROM support_messages m JOIN users u ON u.id = m.author_id
    WHERE m.request_id = r.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) last ON true
`;

// biome-ignore lint/suspicious/noExplicitAny: postgres.js row
function toView(r: any): SupportRequestView {
  return {
    id: r.id,
    ref: formatRequestRef(r.ref_number),
    kind: r.kind,
    status: r.status,
    subject: r.subject,
    customerId: r.customer_id,
    customerName: r.customer_name,
    orderId: r.order_id,
    orderNumber: r.order_number ?? null,
    courierId: r.courier_id,
    courierName: r.courier_name ?? null,
    messageCount: r.message_count,
    lastAuthorRole: r.last_author_role ?? null,
    lastMessageAt: r.last_message_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
  };
}

export async function getRequest(id: string): Promise<SupportRequestView | null> {
  const rows = await sql`${SELECT} WHERE r.id = ${id}`;
  return rows[0] ? toView(rows[0]) : null;
}

export async function listRequestsForCustomer(customerId: string): Promise<SupportRequestView[]> {
  const rows = await sql`${SELECT} WHERE r.customer_id = ${customerId} ORDER BY r.updated_at DESC`;
  return rows.map(toView);
}

export interface AdminRequestFilter {
  // "active" = open + in review (the default inbox); "all" = everything.
  status: SupportStatus | "active" | "all";
  kind: SupportKind | "all";
}

export async function listRequestsForAdmin(f: AdminRequestFilter): Promise<SupportRequestView[]> {
  const status =
    f.status === "all"
      ? sql``
      : f.status === "active"
        ? sql`AND r.status <> 'resolved'`
        : sql`AND r.status = ${f.status}`;
  const kind = f.kind === "all" ? sql`` : sql`AND r.kind = ${f.kind}`;
  // Open first (waiting on us), then in review, then resolved; newest
  // activity first within each.
  const rows = await sql`
    ${SELECT}
    WHERE true ${status} ${kind}
    ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
             r.updated_at DESC
    LIMIT 500
  `;
  return rows.map(toView);
}

// Open + in-review count, for the admin tab label.
export async function countActiveRequests(): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM support_requests WHERE status <> 'resolved'
  `;
  return r?.n ?? 0;
}

export async function listMessages(requestId: string): Promise<SupportMessageView[]> {
  const rows = await sql`
    SELECT m.id, m.author_id, u.name AS author_name, u.role, m.body, m.created_at
    FROM support_messages m JOIN users u ON u.id = m.author_id
    WHERE m.request_id = ${requestId}
    ORDER BY m.created_at, m.id
  `;
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorRole: r.role === "admin" ? "admin" : "customer",
    body: r.body,
    createdAt: r.created_at,
  }));
}

// Customers don't see which admin wrote a reply, only "CarefulTO Support".
export function redactForCustomer(messages: SupportMessageView[]): SupportMessageView[] {
  return messages.map((m) =>
    m.authorRole === "admin" ? { ...m, authorId: "", authorName: "CarefulTO Support" } : m,
  );
}
