// ---------------------------------------------------------------------------
// Fills a *demo* database with ~6 months of synthetic customers, couriers and
// orders across the GTA so the admin Analytics tab has something to show.
//
//   docker exec carefulto_web_app-db-1 psql -U careful2 -c "CREATE DATABASE careful2_demo"
//   DATABASE_URL=postgres://careful2:...@<db-host>:5432/careful2_demo bun run scripts/seed-demo.ts
//
// Refuses to run unless the database name contains "demo", so it can never
// write fake orders into a real database. Pickup regions are not set here:
// start the server against the same database and the region backfill tags
// every order through Nominatim, exactly as it would for real orders.
// ---------------------------------------------------------------------------
import { sql } from "../src/db.ts";
import { migrateAndSeed } from "../src/migrate.ts";
import { hashPassword } from "../src/auth.ts";
import { priceForDistance } from "../src/pricing.ts";
import { ITEM_CATEGORIES } from "../src/categories.ts";

const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
if (!dbName.includes("demo")) {
  console.error(`Refusing to seed "${dbName}": the database name must contain "demo".`);
  process.exit(1);
}

// Deterministic PRNG so every run produces the same dataset.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(xs: readonly T[], weights?: number[]): T => {
  if (!weights) return xs[Math.floor(rand() * xs.length)]!;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < xs.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return xs[i]!;
  }
  return xs[xs.length - 1]!;
};

// Pickup hot spots: [name, lat, lng, weight, spread in degrees].
const HOTSPOTS: [string, number, number, number, number][] = [
  ["Toronto", 43.68, -79.4, 30, 0.07],
  ["Mississauga", 43.6, -79.65, 14, 0.04],
  ["Brampton", 43.72, -79.76, 8, 0.03],
  ["Vaughan", 43.82, -79.52, 9, 0.03],
  ["Markham", 43.87, -79.31, 8, 0.03],
  ["Richmond Hill", 43.88, -79.43, 5, 0.02],
  ["Newmarket", 44.05, -79.46, 3, 0.015],
  ["Aurora", 44.0, -79.46, 2, 0.012],
  ["Whitchurch-Stouffville", 43.97, -79.25, 2, 0.015],
  ["Oakville", 43.45, -79.7, 5, 0.02],
  ["Burlington", 43.34, -79.82, 3, 0.02],
  ["Milton", 43.51, -79.88, 2, 0.015],
  ["Hamilton", 43.25, -79.86, 6, 0.04],
  ["Pickering", 43.84, -79.09, 2, 0.015],
  ["Ajax", 43.86, -79.03, 2, 0.012],
  ["Whitby", 43.88, -78.94, 2, 0.015],
  ["Oshawa", 43.9, -78.86, 3, 0.02],
  ["Barrie", 44.38, -79.69, 1, 0.02],
  ["Guelph", 43.54, -80.25, 1, 0.02],
];
const CATEGORY_WEIGHTS = [10, 22, 14, 6, 7, 9, 8, 6, 5, 3, 4];

const FIRST = ["Aisha", "Ben", "Chen", "Dev", "Elena", "Farid", "Grace", "Hiro", "Imani", "Jonah", "Kavya", "Liam", "Mei", "Noor", "Omar", "Priya", "Quinn", "Rosa", "Sami", "Tara"];
const LAST = ["Ahmed", "Brown", "Chen", "Singh", "Rossi", "Nguyen", "Okafor", "Patel", "Kim", "Martin", "Silva", "Haddad"];

await migrateAndSeed();
await sql`TRUNCATE order_events, orders, sessions RESTART IDENTITY CASCADE`;
await sql`DELETE FROM regions`;
await sql`DELETE FROM users WHERE role <> 'admin'`;
const [admin] = await sql<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;

const START = new Date("2026-06-01T09:00:00-04:00").getTime();
const NOW = Date.now();
const DAY = 86_400_000;
const hash = await hashPassword("demo-password");

// Couriers join over time; customers sign up steadily with growth.
const couriers: { id: string; joined: number }[] = [];
for (let i = 0; i < 9; i++) {
  const joined = START + Math.floor((i / 9) * (NOW - START) * 0.7);
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, password_hash, role, created_at, banned_at)
    VALUES (${`courier${i + 1}@demo.careful2.ca`}, ${`${pick(FIRST)} ${pick(LAST)}`}, ${hash}, 'courier',
            ${new Date(joined)}, ${i === 8 ? new Date(NOW - 10 * DAY) : null})
    RETURNING id
  `;
  couriers.push({ id: u!.id, joined });
}
const customers: { id: string; joined: number }[] = [];
for (let i = 0; i < 140; i++) {
  const joined = START + Math.floor(Math.sqrt(rand()) * (NOW - START));
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, password_hash, role, created_at)
    VALUES (${`customer${i + 1}@demo.careful2.ca`}, ${`${pick(FIRST)} ${pick(LAST)}`}, ${hash}, 'customer', ${new Date(joined)})
    RETURNING id
  `;
  customers.push({ id: u!.id, joined });
}

let orders = 0;
for (let t = START; t < NOW; t += DAY) {
  const progress = (t - START) / (NOW - START);
  const weekday = new Date(t).getDay();
  const base = 2 + progress * 7 + (weekday === 0 ? -2 : weekday === 6 ? -1 : 0);
  const count = Math.max(0, Math.round(base + (rand() - 0.5) * 4));
  for (let k = 0; k < count; k++) {
    const created = t + Math.floor(rand() * 11 * 3_600_000);
    if (created > NOW) continue;
    const eligible = customers.filter((c) => c.joined <= created);
    const avail = couriers.filter((c) => c.joined <= created);
    if (eligible.length === 0 || avail.length === 0) continue;
    const customer = pick(eligible);
    const [, lat, lng, , spread] = pick(HOTSPOTS, HOTSPOTS.map((h) => h[3]));
    const pLat = lat + (rand() - 0.5) * 2 * spread;
    const pLng = lng + (rand() - 0.5) * 2 * spread;
    const km = Math.round((3 + rand() ** 1.6 * 55) * 100) / 100;
    const dLat = pLat + (rand() - 0.5) * km / 80;
    const dLng = pLng + (rand() - 0.5) * km / 60;
    const category = pick(ITEM_CATEGORIES, CATEGORY_WEIGHTS);
    const age = NOW - created;

    // Older orders are finished; the last couple of days are still in flight.
    const rejectedFirst = rand() < 0.12;
    const stage = age > 3 * DAY ? "verified" : age > 1.5 * DAY ? pick(["verified", "completed"]) : pick(["placed", "recommended", "accepted", "completed"]);
    const courier = pick(avail);
    const acceptedAt = created + (20 + rand() * 160) * 60_000 + (rejectedFirst ? 45 * 60_000 : 0);
    const deliveredAt = acceptedAt + (25 + km * 2.2 + rand() * 60) * 60_000;
    const delivered = stage === "completed" || stage === "verified";

    const [o] = await sql<{ id: string }[]>`
      INSERT INTO orders (customer_id, courier_id, item_category, pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng, distance_km, price, status,
        courier_verified_at, customer_verified_at, created_at, updated_at)
      VALUES (${customer.id}, ${stage === "placed" ? null : courier.id}, ${category},
        ${"Demo pickup"}, ${pLat}, ${pLng}, ${"Demo drop-off"}, ${dLat}, ${dLng},
        ${km}, ${priceForDistance(km)}, ${stage},
        ${delivered ? new Date(deliveredAt) : null},
        ${stage === "verified" ? new Date(deliveredAt + 3_600_000) : null},
        ${new Date(created)}, ${new Date(created)})
      RETURNING id
    `;
    const ev = async (type: string, at: number) =>
      sql`INSERT INTO order_events (order_id, actor_id, recipient_id, type, message, created_at, read_at)
          VALUES (${o!.id}, ${admin!.id}, ${admin!.id}, ${type}, ${"demo"}, ${new Date(at)}, ${new Date(at)})`;
    if (stage !== "placed") {
      if (rejectedFirst) {
        await ev("order_recommended", created + 15 * 60_000);
        await ev("order_rejected", created + 40 * 60_000);
      }
      await ev("order_recommended", acceptedAt - 10 * 60_000);
      if (stage !== "recommended") await ev("order_accepted", acceptedAt);
    }
    orders++;
  }
}
console.log(`Seeded ${couriers.length} couriers, ${customers.length} customers, ${orders} orders into ${dbName}.`);
await sql.end();
