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
| Geo (Ontario-only) | Self-hosted Nominatim (autocomplete) + OSRM (routing), Docker |
| Infra     | Docker Compose (app + db + geo services)          |

## Quick start (Docker)

```bash
cp .env.example .env
# (optional) add a free OpenRouteService key so distances are automatic:
#   https://openrouteservice.org/dev/#/signup  -> put it in ORS_API_KEY

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
3. As the customer, place an order (enter pickup + delivery addresses,
   "Calculate price", "Place order").
4. As the admin, **Recommend** the order to the courier.
5. As the courier, **Accept**, then **Report delivered**.
6. As the customer, **Verify delivery completed**.
7. The admin is notified the order is fully verified. Done.

> Without an `ORS_API_KEY`, automatic distance is unavailable and the order form
> asks the customer to enter the distance in km manually. Everything else works.

> **First boot of `nominatim` is slow** (it imports the full Ontario extract into
> its own Postgres — can take several minutes to a while depending on machine
> specs). Address autocomplete simply won't return results until that import
> finishes; nothing else is blocked on it.

## Geo services (Ontario-only)

Address autocomplete and (future) routing are backed by two self-hosted,
**Ontario-only** services — nothing calls out to a third-party routing API at
runtime, and nothing outside the province can ever be returned:

- **Nominatim** (`nominatim` service) — address autocomplete/geocoding, proxied
  by the backend at `GET /api/geo/autocomplete?q=...` and bounded to Ontario by
  `ONTARIO_VIEWBOX`. Imported once from the extract below; `FREEZE=true` since
  this is a static regional snapshot, not a continuously-updated mirror.
- **OSRM** (`osrm` service) — routing engine. Not wired into the app yet; it
  exists so future work (courier → pickup/drop-off routing, nearest-driver via
  OSRM's `table` matrix endpoint) has somewhere to call. Pricing still uses the
  existing OpenRouteService distance lookup (`server/src/distance.ts`),
  unchanged by this.

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

**Not yet implemented** (by design, for this PR): courier live-location
tracking, a nearest-driver endpoint, and switching the pricing distance
calculation over to the self-hosted OSRM. Those depend on real courier GPS
data and are future work.

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
- **Geo (autocomplete/routing):** see [Geo services (Ontario-only)](#geo-services-ontario-only)
  above. Config: `NOMINATIM_URL`, `OSRM_URL`, `ONTARIO_VIEWBOX`, `NOMINATIM_PASSWORD`.

## Project layout

```
db/schema.sql            Postgres schema (applied on boot, idempotent)
scripts/fetch-ontario-osm.sh  One-time OSM extract download for the geo services
server/                  Bun API server + static SPA host
  src/routes/            Route handlers (auth, orders, admin, courier, geo, ...)
  src/distance.ts        Swappable distance/geocoding provider (pricing)
  src/geo.ts             Nominatim-backed address autocomplete (Ontario-only)
  src/pricing.ts         Pricing formula
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
