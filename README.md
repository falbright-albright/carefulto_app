# Careful2 — Delivery Platform

A courier/delivery web app with three roles — **customer**, **courier**, and
**admin** — covering the full order lifecycle: placement → admin recommendation →
courier accept/reject → delivery → mutual verification → completion, plus admin
moderation (ban customers/couriers).

## Stack

| Layer     | Tech                                             |
|-----------|--------------------------------------------------|
| Frontend  | React + TypeScript, Vite, Tailwind, **shadcn/ui**|
| Backend   | **Bun** HTTP server (`Bun.serve`)                |
| Database  | **PostgreSQL** 16                                |
| Distance  | OpenRouteService (real road distance + geocoding)|
| Infra     | Docker Compose (app + db)                         |

## Quick start (Docker)

```bash
cp .env.example .env
# (optional) add a free OpenRouteService key so distances are automatic:
#   https://openrouteservice.org/dev/#/signup  -> put it in ORS_API_KEY
docker compose up --build
```

Then open **http://localhost:3001**.

A default admin is seeded on first boot from `.env`:
`admin@careful2.ca` / `changeme123` — **change these**.

### First run walkthrough
1. Log in as the admin → **Users** tab → create a **courier** account.
2. Register a **customer** (from the login page → "Create an account").
3. As the customer, place an order (enter pickup + delivery addresses,
   "Calculate price", "Place order").
4. As the admin, **Recommend** the order to the courier.
5. As the courier, **Accept**, then **Report delivered**.
6. As the customer, **Verify delivery completed**.
7. The admin is notified the order is fully verified. Done.

> Without an `ORS_API_KEY`, automatic distance is unavailable and the order form
> asks the customer to enter the distance in km manually. Everything else works.

## Local development (without Docker for the app)

Run Postgres (via compose) and the two dev servers:

```bash
docker compose up -d db                 # Postgres on :5432
cd server && bun install && DATABASE_URL=postgres://careful2:careful2_dev_password@localhost:5432/careful2 bun run dev
cd web    && bun install && bun run dev # Vite on :5173, proxies /api -> :3001
```

Open **http://localhost:5173** for the dev frontend.

## Configuration

All configuration is via environment variables — see [`.env.example`](.env.example).

- **Pricing:** `price = max(PRICE_MIN, PRICE_BASE + PRICE_PER_KM × distance_km)`.
  Defaults: base $5, $1.50/km, min $8, CAD.
- **Item categories:** edit [`server/src/categories.ts`](server/src/categories.ts)
  — the single source of truth (the frontend fetches it). These are currently
  **placeholders**; replace them with Careful2's real categories.
- **Distance provider:** OpenRouteService is wrapped behind a small interface in
  [`server/src/distance.ts`](server/src/distance.ts) — swap in Geoapify,
  LocationIQ, or a self-hosted OSRM by implementing `DistanceProvider`.

## Project layout

```
db/schema.sql            Postgres schema (applied on boot, idempotent)
server/                  Bun API server + static SPA host
  src/routes/            Route handlers (auth, orders, admin, courier, ...)
  src/distance.ts        Swappable distance/geocoding provider
  src/pricing.ts         Pricing formula
web/                     React + shadcn frontend
Dockerfile               Multi-stage: build web -> Bun runtime serving both
docker-compose.yml       app + postgres
```

## Notes / known limitations (v1)

- Notifications are **in-app only** (a bell feed, polled every 15s).
- Payment is **calculated and recorded only** — no real transaction.
- careful2.ca was unreachable at build time, so item categories are placeholders.
