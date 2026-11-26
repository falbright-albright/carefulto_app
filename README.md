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
| Geo (Ontario-only) | Self-hosted Nominatim (autocomplete) + OSRM (routing **and pricing distance**), Docker |
| Infra     | Docker Compose (app + db + geo services)          |

## Quick start (Docker)

```bash
cp .env.example .env

# one-time: fetch the Ontario OSM extract used by the geo services below
./scripts/fetch-ontario-osm.sh
docker compose --profile setup run --rm osrm-build   # one-time: build the routing graph

docker compose up --build
```

Then open **http://localhost:3001**.

A default admin is seeded on first boot from `.env`:
`admin@careful2.ca` / `changeme123` — **change these**.

### First run walkthrough
1. Log in as the admin → **Users** tab → create a **courier** account.
2. Register a **customer** (from the login page → "Create an account").
3. As the customer, place an order (pick pickup + delivery addresses from the
   suggestions, add any delivery notes, "Calculate price", "Place order").
4. As the admin, **Recommend** the order to the courier.
5. As the courier, **Accept**, then **Report delivered**.
6. As the customer, **Verify delivery completed**.
7. The admin is notified the order is fully verified. Done.

> **First boot of `nominatim` is slow** (it imports the full Ontario extract into
> its own Postgres — can take several minutes to a while depending on machine
> specs). Address autocomplete simply won't return results until that import
> finishes; nothing else is blocked on it.

## Geo services (Ontario-only)

Address autocomplete, routing and pricing are backed by two self-hosted,
**Ontario-only** services — nothing calls out to a third-party routing API at
runtime, and nothing outside the province can ever be returned:

- **Nominatim** (`nominatim` service) — address autocomplete/geocoding, proxied
  by the backend at `GET /api/geo/autocomplete?q=...` and bounded to Ontario by
  `ONTARIO_VIEWBOX`. Imported once from the extract below; `FREEZE=true` since
  this is a static regional snapshot, not a continuously-updated mirror.
- **OSRM** (`osrm` service) — routing engine. Gives the driving distance
  between the two pins the customer selected; that distance sets the price
  (`POST /api/orders/quote`, recomputed server-side on `POST /api/orders`) and
  the same route is drawn on the map. If OSRM can't route, the quote fails with
  a "try again" message — customers can't enter a distance themselves.

Addresses missing from the suggestion list (e.g. a specific building on a
large property) are handled by the order's **Delivery notes** field: the
customer picks the nearest suggested address and describes the exact spot.
Notes are shown to the admin and the assigned courier.

Both are built from the **same one-time OSM extract**:

```bash
./scripts/fetch-ontario-osm.sh                     # downloads data/osm/ontario-latest.osm.pbf (skips if present)
docker compose --profile setup run --rm osrm-build # builds data/osrm/ontario-latest.osrm (skips if present)
```

`data/` is gitignored — re-run `fetch-ontario-osm.sh` (after deleting the file)
to refresh the extract, and re-run `osrm-build` to rebuild the graph from it.

**Why Nominatim + OSRM instead of a fully self-hosted OpenRouteService:**
self-hosting ORS's own geocoding requires a separate Pelias/Elasticsearch
stack; Nominatim is the standard, much lighter way to self-host OSM geocoding,
and OSRM's `table` endpoint is exactly the multi-point distance matrix that
"nearest driver to an address" will need later.

**Not yet implemented:** courier live-location tracking and a nearest-driver
endpoint. Those depend on real courier GPS data and are future work.

## Admin analytics

The admin dashboard's **Analytics** tab reports on the business month by month
(pick any month since the first order; month-in-progress figures are compared
with the same days of the previous month):

- **KPI boxes:** registered customers, couriers, new customers, delivery
  requests, average delivery price, deliveries per courier, revenue recorded,
  average distance, courier acceptance rate, time to courier acceptance, repeat
  customers, and orders waiting for a courier.
- **Deliveries per day** for the chosen month.
- **Pickup requests by region:** a map of GTA/Hamilton municipalities shaded by
  pickup count (with counts printed on the map), for the chosen month or all time.
- **Requests by item category:** for the chosen month or all time, plus a
  12-month category × month grid.
- **Metrics to add next:** suggested KPIs and what data each one needs.

Definitions: a *request* is an order placed (dated by when it was placed); a
*delivery* is an order the courier reported delivered (dated by that report).
Days and months are bucketed in `ANALYTICS_TZ` (default `America/Toronto`).

**How regions work.** OSRM only knows roads, so regions come from the
self-hosted **Nominatim** built from the same Ontario extract: when an order is
placed, its pickup point is reverse-geocoded at city level, which returns the
municipality's OSM administrative boundary (e.g. Mississauga, relation
1954127) *and its outline*. Sub-municipal areas (Toronto's former boroughs
like North York) are rolled up to their city. The region and outline are
stored in the `regions` table and orders get `pickup_region_id`. Older orders
are backfilled automatically. A curated set of GTA + Hamilton municipalities is
always drawn (so a region with zero pickups shows as zero); regions elsewhere
(Barrie, Guelph, ...) appear once a pickup lands there. Nothing external is
called (map tiles aside).

**Previewing with demo data.** `server/scripts/seed-demo.ts` fills a database
whose name contains `demo` (it refuses anything else) with ~6 months of
synthetic GTA orders:

```bash
docker compose exec db psql -U careful2 -c "CREATE DATABASE careful2_demo"
cd server
DATABASE_URL=postgres://careful2:careful2_dev_password@<db-host>:5432/careful2_demo bun run seed:demo
DATABASE_URL=...careful2_demo PORT=3011 NOMINATIM_URL=http://localhost:8089 OSRM_URL=http://localhost:5000 bun run dev
cd ../web && API_PROXY_TARGET=http://localhost:3011 bun run dev
```

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
  `distance_km` is the OSRM driving distance. Defaults: base $5, $1.75/km, min $15, CAD.
- **Item categories:** edit [`server/src/categories.ts`](server/src/categories.ts)
  — the single source of truth (the frontend fetches it). These are currently
  **placeholders**; replace them with Careful2's real categories.
- **Geo (autocomplete/routing):** see [Geo services (Ontario-only)](#geo-services-ontario-only)
  above. Config: `NOMINATIM_URL`, `OSRM_URL`, `ONTARIO_VIEWBOX`, `NOMINATIM_PASSWORD`.

## Project layout

```
db/schema.sql            Postgres schema (applied on boot, idempotent)
scripts/fetch-ontario-osm.sh  One-time OSM extract download for the geo services
server/                  Bun API server + static SPA host
  src/routes/            Route handlers (auth, orders, admin, courier, geo, ...)
  src/routing.ts         OSRM driving distance/route (pricing + map line)
  src/geo.ts             Nominatim-backed address autocomplete (Ontario-only)
  src/pricing.ts         Pricing formula
  src/regions.ts         Pickup -> municipality (Nominatim) for analytics
  src/routes/analytics.ts  Admin analytics endpoints
  scripts/seed-demo.ts   Synthetic data for a *demo* database
web/                     React + shadcn frontend
  src/components/AddressAutocomplete.tsx  Debounced address search-as-you-type
  src/components/LocationMap.tsx          Small Ontario-bounded map preview (Leaflet)
Dockerfile               Multi-stage: build web -> Bun runtime serving both
docker-compose.yml       app + postgres + nominatim + osrm
```

## Notes / known limitations (v1)

- Notifications are **in-app only** (a bell feed, polled every 15s).
- Payment is **calculated and recorded only** — no real transaction.
- careful2.ca was unreachable at build time, so item categories are placeholders.
