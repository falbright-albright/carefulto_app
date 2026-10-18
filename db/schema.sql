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
  distance_source     TEXT NOT NULL DEFAULT 'ors',   -- ors | manual
  price               NUMERIC(10, 2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'CAD',

  status              order_status NOT NULL DEFAULT 'placed',
  customer_verified_at TIMESTAMPTZ,
  courier_verified_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
