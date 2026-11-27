// Integration test for the order state machine against a real Postgres.
// Every order action re-checks the order's status inside its UPDATE, so an
// admin cancel can't be overwritten by a courier action that read the order
// a moment earlier (and vice versa).
//
// Skipped unless INTEGRATION_DB=1, because it needs a throwaway database:
//   INTEGRATION_DB=1 DATABASE_URL=postgres://.../scratch bun test orderGuards
// CI runs it in the e2e job against a fresh Postgres service.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { User } from "../auth.ts";
import { sql } from "../db.ts";
import { migrateAndSeed } from "../migrate.ts";
import { cancelOrder, recommend } from "./admin.ts";
import { accept, reject } from "./courier.ts";
import { myAccount } from "./courier.ts";
import { complete, getOne, verify } from "./orders.ts";

const enabled = process.env.INTEGRATION_DB === "1";
const post = (body: unknown = {}) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let admin: User;
let courier: User;
let customer: User;

async function makeUser(role: "admin" | "courier" | "customer"): Promise<User> {
  const email = `${role}-${crypto.randomUUID()}@guards.test`;
  const [u] = await sql<User[]>`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${`Guard ${role}`}, 'x', ${role})
    RETURNING id, email, name, role, banned_at, created_at
  `;
  return u!;
}

async function makeOrder(status: string, courierId: string | null = null): Promise<string> {
  const [o] = await sql<{ id: string }[]>`
    INSERT INTO orders (customer_id, courier_id, item_category, pickup_address,
                        dropoff_address, distance_km, price, status)
    VALUES (${customer.id}, ${courierId}, 'Documents', 'A St', 'B St', 5, 15,
            ${status}::order_status)
    RETURNING id
  `;
  return o!.id;
}

const statusOf = async (id: string) =>
  (await sql<{ status: string }[]>`SELECT status FROM orders WHERE id = ${id}`)[0]!.status;

describe.skipIf(!enabled)("order actions re-check status in the UPDATE", () => {
  beforeAll(async () => {
    await migrateAndSeed();
    admin = await makeUser("admin");
    courier = await makeUser("courier");
    customer = await makeUser("customer");
  });
  afterAll(async () => {
    await sql.end();
  });

  test("a cancelled order can't then be accepted, rejected or reported delivered", async () => {
    const recommended = await makeOrder("recommended", courier.id);
    expect((await cancelOrder(post(), { id: recommended }, admin)).status).toBe(200);
    expect((await accept(post(), { id: recommended }, courier)).status).toBeGreaterThanOrEqual(400);
    expect((await reject(post(), { id: recommended }, courier)).status).toBeGreaterThanOrEqual(400);
    expect(await statusOf(recommended)).toBe("cancelled");

    const accepted = await makeOrder("accepted", courier.id);
    expect((await cancelOrder(post(), { id: accepted }, admin)).status).toBe(200);
    expect((await complete(post(), { id: accepted }, courier)).status).toBeGreaterThanOrEqual(400);
    expect(await statusOf(accepted)).toBe("cancelled");
  });

  test("cancel racing 'report delivered': exactly one wins and the row stays consistent", async () => {
    for (let i = 0; i < 25; i++) {
      const id = await makeOrder("accepted", courier.id);
      const [c, d] = await Promise.all([
        cancelOrder(post(), { id }, admin),
        complete(post(), { id }, courier),
      ]);
      // Exactly one of the two succeeds. The loser is refused either by the
      // up-front status check (400) or, if it read the order first, by the
      // guarded UPDATE (409).
      const codes = [c.status, d.status].sort();
      expect(codes[0]).toBe(200);
      expect([400, 409]).toContain(codes[1]);
      const [row] = await sql`
        SELECT status, cancelled_at, courier_verified_at FROM orders WHERE id = ${id}
      `;
      if (row!.status === "cancelled") expect(row!.courier_verified_at).toBeNull();
      else {
        expect(row!.status).toBe("completed");
        expect(row!.cancelled_at).toBeNull();
      }
    }
  });

  test("cancel racing accept: never leaves a cancelled order accepted", async () => {
    for (let i = 0; i < 25; i++) {
      const id = await makeOrder("recommended", courier.id);
      const [c, a] = await Promise.all([
        cancelOrder(post(), { id }, admin),
        accept(post(), { id }, courier),
      ]);
      // Accepted orders are still cancellable, so whichever runs first the
      // cancel must succeed and the order must end up cancelled. Before the
      // guard, a late accept could flip a cancelled order back to accepted.
      expect(c.status).toBe(200);
      expect([200, 409]).toContain(a.status);
      expect(await statusOf(id)).toBe("cancelled");
    }
  });

  test("recommend only applies to an order that is still placed", async () => {
    const id = await makeOrder("placed");
    await cancelOrder(post(), { id }, admin);
    const res = await recommend(post({ courierId: courier.id }), { id }, admin);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await statusOf(id)).toBe("cancelled");
  });

  test("double-submitted verify finalizes once and notifies admins once", async () => {
    const id = await makeOrder("completed", courier.id);
    await sql`UPDATE orders SET courier_verified_at = now() WHERE id = ${id}`;
    await Promise.all([verify(post(), { id }, customer), verify(post(), { id }, customer)]);
    expect(await statusOf(id)).toBe("verified");
    const [t] = await sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM order_events
      WHERE order_id = ${id} AND type = 'order_verified' AND recipient_id = ${courier.id}
    `;
    expect(t!.total).toBe(1);
  });

  test("verify stores an optional rating; couriers see stars but not the comment", async () => {
    const rater = await makeUser("courier");
    const ids = [];
    for (const _ of [0, 1, 2]) {
      const id = await makeOrder("completed", rater.id);
      await sql`UPDATE orders SET courier_verified_at = now() WHERE id = ${id}`;
      ids.push(id);
    }
    // Bad input is refused and the order stays unverified.
    expect((await verify(post({ rating: 6 }), { id: ids[0]! }, customer)).status).toBe(400);
    expect(await statusOf(ids[0]!)).toBe("completed");

    expect((await verify(post({ rating: 5, comment: " Great " }), { id: ids[0]! }, customer)).status).toBe(200);
    expect((await verify(post({ rating: 4 }), { id: ids[1]! }, customer)).status).toBe(200);
    expect((await verify(post(), { id: ids[2]! }, customer)).status).toBe(200); // unrated

    const [row] = await sql`SELECT status, rating, rating_comment FROM orders WHERE id = ${ids[0]!}`;
    expect(row).toEqual({ status: "verified", rating: 5, rating_comment: "Great" });

    const asCourier = (await (await getOne(post(), { id: ids[0]! }, rater)).json()) as {
      order: { rating: number; ratingComment: string | null };
    };
    expect(asCourier.order.rating).toBe(5);
    expect(asCourier.order.ratingComment).toBeNull();
    const asCustomer = (await (await getOne(post(), { id: ids[0]! }, customer)).json()) as {
      order: { ratingComment: string | null };
    };
    expect(asCustomer.order.ratingComment).toBe("Great");

    // Average over rated deliveries only: (5 + 4) / 2.
    const acct = (await (await myAccount(post(), {}, rater)).json()) as {
      courier: { averageRating: number; ratedDeliveries: number; delivered: number };
    };
    expect(acct.courier.averageRating).toBe(4.5);
    expect(acct.courier.ratedDeliveries).toBe(2);
    expect(acct.courier.delivered).toBe(3);
  });
});
