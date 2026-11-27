// Integration test for "Contact us" support requests against a real Postgres.
// Skipped unless INTEGRATION_DB=1 (see orderGuards.integration.test.ts).
import { beforeAll, describe, expect, test } from "bun:test";
import type { User } from "../auth.ts";
import { sql } from "../db.ts";
import { migrateAndSeed } from "../migrate.ts";
import { create, getOne, list, reply, setStatus } from "./support.ts";

const enabled = process.env.INTEGRATION_DB === "1";
const post = (body: unknown = {}) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const get = (qs = "") => new Request(`http://localhost/x${qs}`);

let admin: User;
let courier: User;
let customer: User;
let stranger: User;

async function makeUser(role: "admin" | "courier" | "customer"): Promise<User> {
  const email = `${role}-${crypto.randomUUID()}@support.test`;
  const [u] = await sql<User[]>`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${`Support ${role}`}, 'x', ${role})
    RETURNING id, email, name, role, banned_at, created_at
  `;
  return u!;
}

async function makeOrder(owner: User, courierId: string | null): Promise<string> {
  const [o] = await sql<{ id: string }[]>`
    INSERT INTO orders (customer_id, courier_id, item_category, pickup_address,
                        dropoff_address, distance_km, price, status)
    VALUES (${owner.id}, ${courierId}, 'Documents', 'A St', 'B St', 5, 15,
            ${courierId ? "verified" : "placed"}::order_status)
    RETURNING id
  `;
  return o!.id;
}

// biome-ignore lint/suspicious/noExplicitAny: test JSON
const body = async (r: Response): Promise<any> => r.json();

// Notification types sent to `u` about one request, oldest first.
const notificationsFor = async (u: User, requestId: string): Promise<string[]> =>
  (
    await sql<{ type: string }[]>`
      SELECT type FROM order_events
      WHERE recipient_id = ${u.id} AND support_request_id = ${requestId}
      ORDER BY created_at
    `
  ).map((n) => n.type);

describe.skipIf(!enabled)("support requests", () => {
  beforeAll(async () => {
    await migrateAndSeed();
    admin = await makeUser("admin");
    courier = await makeUser("courier");
    customer = await makeUser("customer");
    stranger = await makeUser("customer");
  });
  // No sql.end(): bun runs every integration file in one process and shares
  // the connection (see orderGuards.integration.test.ts).

  test("a courier complaint is filed against the order's courier and notifies admins", async () => {
    const orderId = await makeOrder(customer, courier.id);
    const res = await create(
      post({ kind: "courier", orderId, subject: "Rude courier", message: "They threw the box." }),
      {},
      customer,
    );
    expect(res.status).toBe(201);
    const { request } = await body(res);
    expect(request).toMatchObject({
      kind: "courier",
      status: "open",
      orderId,
      courierId: courier.id,
      courierName: courier.name,
      messageCount: 1,
      lastAuthorRole: "customer",
    });
    expect(request.ref).toMatch(/^RQ-\d+$/);
    expect(await notificationsFor(admin, request.id)).toEqual(["support_request_created"]);
  });

  test("customers can only file about their own orders, and courier complaints need a courier", async () => {
    const theirs = await makeOrder(stranger, courier.id);
    const r1 = await create(
      post({ kind: "delivery", orderId: theirs, subject: "x", message: "y" }),
      {},
      customer,
    );
    expect(r1.status).toBe(404);

    const unassigned = await makeOrder(customer, null);
    const r2 = await create(
      post({ kind: "courier", orderId: unassigned, subject: "x", message: "y" }),
      {},
      customer,
    );
    expect(r2.status).toBe(400);
  });

  test("the conversation: reply, status changes, reopen on customer reply", async () => {
    const created = await body(
      await create(
        post({ kind: "question", subject: "Weekends?", message: "Do you deliver Sundays?" }),
        {},
        customer,
      ),
    );
    const id = created.request.id as string;

    // Another customer can't see it.
    expect((await getOne(get(), { id }, stranger)).status).toBe(403);
    expect((await reply(post({ message: "hi" }), { id }, stranger)).status).toBe(403);

    // Admin reply -> in review, customer notified, admin name hidden from customer.
    const afterReply = await body(await reply(post({ message: "Yes, 9 to 5." }), { id }, admin));
    expect(afterReply.request.status).toBe("in_review");
    expect(afterReply.messages).toHaveLength(2);
    expect(afterReply.messages[1].authorName).toBe(admin.name);
    const asCustomer = await body(await getOne(get(), { id }, customer));
    expect(asCustomer.messages[1]).toMatchObject({
      authorRole: "admin",
      authorName: "CarefulTO Support",
    });

    // Resolve -> customer notified.
    const resolved = await body(await setStatus(post({ status: "resolved" }), { id }, admin));
    expect(resolved.request.status).toBe("resolved");
    expect(resolved.request.resolvedAt).not.toBeNull();
    expect(await notificationsFor(customer, id)).toEqual(["support_reply", "support_status"]);

    // Customer replies on a resolved request -> reopened, admins notified.
    const reopened = await body(await reply(post({ message: "And holidays?" }), { id }, customer));
    expect(reopened.request).toMatchObject({
      status: "open",
      resolvedAt: null,
      lastAuthorRole: "customer",
    });
    expect(await notificationsFor(admin, id)).toContain("support_customer_reply");

    // Bad status / empty reply are rejected.
    expect((await setStatus(post({ status: "closed" }), { id }, admin)).status).toBe(400);
    expect((await reply(post({ message: "  " }), { id }, customer)).status).toBe(400);
  });

  test("lists: customers see only their own; admins filter by status and kind", async () => {
    const mine = await body(await list(get(), {}, customer));
    expect(mine.requests.length).toBeGreaterThan(0);
    expect(mine.requests.every((r: { customerId: string }) => r.customerId === customer.id)).toBe(
      true,
    );

    const courierOnly = await body(await list(get("?status=all&kind=courier"), {}, admin));
    expect(courierOnly.requests.length).toBeGreaterThan(0);
    expect(courierOnly.requests.every((r: { kind: string }) => r.kind === "courier")).toBe(true);

    const active = await body(await list(get(), {}, admin));
    expect(active.requests.every((r: { status: string }) => r.status !== "resolved")).toBe(true);
    expect(active.active).toBeGreaterThanOrEqual(active.requests.length);

    expect((await list(get("?status=nope"), {}, admin)).status).toBe(400);
    expect((await getOne(get(), { id: "not-a-uuid" }, admin)).status).toBe(404);
  });
});
