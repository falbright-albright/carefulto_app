// Centralised, typed access to environment configuration.

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env var ${key} must be a number, got: ${v}`);
  return n;
}

export const config = {
  port: num("PORT", 3001),
  databaseUrl: str("DATABASE_URL"),

  admin: {
    email: str("ADMIN_EMAIL", "admin@careful2.ca"),
    password: str("ADMIN_PASSWORD", "changeme123"),
    name: str("ADMIN_NAME", "Careful2 Admin"),
  },

  distance: {
    provider: str("DISTANCE_PROVIDER", "ors"),
    orsApiKey: process.env.ORS_API_KEY ?? "",
  },

  geo: {
    // Self-hosted, Ontario-only Nominatim instance (see docker-compose.yml).
    nominatimUrl: str("NOMINATIM_URL", "http://nominatim:8080"),
    // minLon,minLat,maxLon,maxLat — bounds autocomplete to Ontario.
    ontarioViewbox: str("ONTARIO_VIEWBOX", "-95.2,41.6,-74.3,56.9"),
  },

  pricing: {
    base: num("PRICE_BASE", 5.0),
    perKm: num("PRICE_PER_KM", 1.5),
    min: num("PRICE_MIN", 8.0),
    currency: str("CURRENCY", "CAD"),
  },

  sessionTtlDays: 30,
};

export type Config = typeof config;
