-- Careful2 delivery platform schema
-- Applied automatically on first boot of the Postgres container (mounted into
-- /docker-entrypoint-initdb.d). Safe to re-run: uses IF NOT EXISTS everywhere.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Users: customers, couriers, and admins all live in one table, split by role.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'courier', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'customer',
  banned_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sessions: opaque bearer tokens. Deleting a row (or banning a user) revokes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- Orders and their lifecycle.
--   placed        -> customer created it, waiting on admin
--   recommended   -> admin recommended it to a courier, waiting on courier
--   accepted      -> courier accepted, delivery in progress
--   rejected      -> courier rejected; admin re-recommends (back to queue)
--   completed     -> courier reported completion, waiting on verifications
--   verified      -> both customer and courier verified -> admin notified, done
--   cancelled     -> (reserved) customer/admin cancellation
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM
    ('placed', 'recommended', 'accepted', 'rejected', 'completed', 'verified', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES users(id),
  courier_id          UUID REFERENCES users(id),

  item_category       TEXT NOT NULL,
  item_description    TEXT,

  pickup_address      TEXT NOT NULL,
  pickup_lat          DOUBLE PRECISION,
  pickup_lng          DOUBLE PRECISION,
  dropoff_address     TEXT NOT NULL,
  dropoff_lat         DOUBLE PRECISION,
  dropoff_lng         DOUBLE PRECISION,

  distance_km         NUMERIC(10, 2) NOT NULL,
  distance_source     TEXT NOT NULL DEFAULT 'osrm',  -- osrm (legacy rows: ors | manual)
  price               NUMERIC(10, 2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'CAD',

  status              order_status NOT NULL DEFAULT 'placed',
  customer_verified_at TIMESTAMPTZ,
  courier_verified_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Free-text delivery notes from the customer (e.g. the exact building or
-- entrance when their address isn't in the suggestion list). Added after the
-- initial schema, so it's an idempotent ALTER for existing databases.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier  ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

-- ---------------------------------------------------------------------------
-- Order events double as the in-app notification feed. Each event targets a
-- user (recipient) and belongs to an order. `read_at` tracks per-user reads.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES users(id),           -- who caused the event
  recipient_id UUID REFERENCES users(id),           -- who should be notified
  type         TEXT NOT NULL,                        -- machine-readable event key
  message      TEXT NOT NULL,                        -- human-readable text
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_recipient ON order_events(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_events_order      ON order_events(order_id);

-- ---------------------------------------------------------------------------
-- Regions (municipalities) for admin analytics. A region is an OSM
-- administrative boundary resolved by reverse-geocoding against the same
-- self-hosted, Ontario-only Nominatim instance used for autocomplete — e.g.
-- Mississauga, Vaughan, Hamilton. `geojson` is the simplified boundary used to
-- draw the region on the analytics map. `baseline` marks the curated
-- GTA/Hamilton set that is always drawn (even with zero pickups).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id          TEXT PRIMARY KEY,           -- OSM type initial + id, e.g. "R1954127"
  name        TEXT NOT NULL,
  county      TEXT,                       -- e.g. "York Region" (null for single-tier cities)
  geojson     JSONB,
  baseline    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which region each order's pickup falls in. Resolved best-effort after the
-- order is placed (and backfilled for older orders); `pickup_region_checked_at`
-- stops a point that resolves to no region from being re-queried forever.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_region_id TEXT REFERENCES regions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_region_checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_region ON orders(pickup_region_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ---------------------------------------------------------------------------
-- Order numbers: short, human-friendly references (shown as CT-1001) that
-- customers and admins can quote for cancellations and refunds. New orders
-- take the next number from the sequence; orders that predate this column
-- are backfilled oldest-first, continuing after the highest number in use.
-- Every statement is idempotent, so this is safe on every boot.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

WITH base AS (SELECT COALESCE(MAX(order_number), 1000) AS n FROM orders),
     todo AS (
       SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
       FROM orders WHERE order_number IS NULL
     )
UPDATE orders o SET order_number = base.n + todo.rn
FROM todo, base WHERE o.id = todo.id;

-- Keep the sequence ahead of every number already handed out.
SELECT setval('order_number_seq', GREATEST((SELECT MAX(order_number) FROM orders), 1000));

ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('order_number_seq');
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

-- ---------------------------------------------------------------------------
-- Cancellation. A cancelled order keeps all its data; these record who
-- cancelled it, when and why. refund_status tracks the money side:
--   NULL      nothing to refund
--   'pending' a refund is owed (set on cancel) — paying it out is future work
--   'refunded' reserved for the refund feature
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by  UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT;

-- ---------------------------------------------------------------------------
-- Delivery rating. When verifying a delivery the customer may rate it 1–5
-- stars and leave a short comment (both optional). A courier's average
-- rating is the mean over their rated deliveries; unrated ones don't count.
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating SMALLINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_comment TEXT;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_rating_range CHECK (rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
