import { sql } from "./db.ts";
import { config } from "./config.ts";

// ---------------------------------------------------------------------------
// Regions for admin analytics ("how many pickups in Mississauga this month").
//
// OSRM only knows roads, not municipalities, so regions come from the other
// self-hosted geo service built from the same Ontario extract: Nominatim.
// Reverse-geocoding a point at zoom=10 returns the municipality containing it
// (Mississauga, Vaughan, Hamilton, Whitchurch-Stouffville, ...) as an OSM
// administrative boundary relation, and polygon_geojson=1 returns that
// boundary's outline — which is exactly what the analytics map draws. Nothing
// leaves the machine and no boundary dataset has to be maintained separately.
// ---------------------------------------------------------------------------

export interface ResolvedRegion {
  id: string; // e.g. "R1954127" (OSM relation 1954127 = Mississauga)
  name: string;
  county: string | null;
  geojson: unknown | null;
}

// Curated GTA + Hamilton municipalities that are always drawn on the map, so
// a region with zero pickups shows as zero instead of being absent. One point
// inside each; the boundary itself comes from Nominatim. Regions outside this
// set (e.g. Barrie, Guelph) still appear automatically once a pickup lands there.
export const BASELINE_POINTS: { name: string; lat: number; lng: number }[] = [
  { name: "Toronto", lat: 43.6532, lng: -79.3832 },
  { name: "Mississauga", lat: 43.589, lng: -79.644 },
  { name: "Brampton", lat: 43.7315, lng: -79.7624 },
  { name: "Caledon", lat: 43.866, lng: -79.858 },
  { name: "Vaughan", lat: 43.837, lng: -79.508 },
  { name: "Markham", lat: 43.8561, lng: -79.337 },
  { name: "Richmond Hill", lat: 43.8828, lng: -79.4403 },
  { name: "Aurora", lat: 44.0065, lng: -79.4504 },
  { name: "Newmarket", lat: 44.059, lng: -79.461 },
  { name: "King", lat: 43.96, lng: -79.6 },
  { name: "Whitchurch-Stouffville", lat: 43.97, lng: -79.25 },
  { name: "East Gwillimbury", lat: 44.1, lng: -79.43 },
  { name: "Georgina", lat: 44.3, lng: -79.43 },
  { name: "Pickering", lat: 43.8384, lng: -79.0868 },
  { name: "Ajax", lat: 43.8509, lng: -79.0204 },
  { name: "Whitby", lat: 43.8975, lng: -78.9429 },
  { name: "Oshawa", lat: 43.8971, lng: -78.8658 },
  { name: "Clarington", lat: 43.935, lng: -78.68 },
  { name: "Uxbridge", lat: 44.108, lng: -79.12 },
  { name: "Scugog", lat: 44.11, lng: -78.94 },
  { name: "Brock", lat: 44.35, lng: -79.1 },
  { name: "Oakville", lat: 43.4675, lng: -79.6877 },
  { name: "Burlington", lat: 43.3255, lng: -79.799 },
  { name: "Milton", lat: 43.5183, lng: -79.8774 },
  { name: "Halton Hills", lat: 43.63, lng: -79.95 },
  { name: "Hamilton", lat: 43.256, lng: -79.869 },
];

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  place_rank?: number;
  address?: Record<string, string | undefined>;
  geojson?: { type?: string };
  error?: string;
}

// Address types that are a whole municipality (as opposed to a former borough
// like North York, which OSM tags city_district/suburb inside Toronto).
const MUNICIPAL_TYPES = new Set(["city", "town", "village", "municipality"]);

// Province/country-level results (rank < 12) mean the point is not inside
// any municipality — typically open water like Lake Ontario.
const MIN_MUNICIPAL_RANK = 12;

function isMunicipalBoundary(d: NominatimPlace): boolean {
  return (
    d.category === "boundary" &&
    d.type === "administrative" &&
    (d.place_rank ?? 0) >= MIN_MUNICIPAL_RANK &&
    MUNICIPAL_TYPES.has(d.addresstype ?? "")
  );
}

function toRegion(d: NominatimPlace): ResolvedRegion | null {
  if (!d.osm_type || d.osm_id === undefined || !d.name) return null;
  const county = d.address?.county;
  const isArea = d.geojson?.type === "Polygon" || d.geojson?.type === "MultiPolygon";
  return {
    id: `${d.osm_type[0]!.toUpperCase()}${d.osm_id}`,
    name: d.name,
    // A county equal to the name itself (single-tier cities) adds nothing.
    county: county && county !== d.name ? county : null,
    geojson: isArea ? d.geojson : null,
  };
}

export type ReverseOutcome =
  | { kind: "region"; region: ResolvedRegion }
  | { kind: "parent"; name: string; county: string | null }
  | { kind: "none" };

// Classify a reverse-geocode result at city zoom:
//   - an administrative municipality boundary  -> use it directly
//   - anything finer or odd (a former borough such as North York, a stray
//     place=city outline) -> roll up to the municipality named in its address
//   - province-level or nothing (open water)   -> no region
export function classifyReverse(d: NominatimPlace): ReverseOutcome {
  if (d.error || (d.place_rank ?? 0) < MIN_MUNICIPAL_RANK) return { kind: "none" };
  if (isMunicipalBoundary(d)) {
    const region = toRegion(d);
    return region ? { kind: "region", region } : { kind: "none" };
  }
  const a = d.address ?? {};
  const name = a.city || a.town || a.village || a.municipality;
  if (!name) return { kind: "none" };
  return { kind: "parent", name, county: a.county ?? null };
}

const GEOMETRY_PARAMS: [string, string][] = [
  ["format", "jsonv2"],
  ["addressdetails", "1"],
  ["polygon_geojson", "1"],
  // Simplify the outline (degrees). ~100m tolerance keeps a municipality at
  // a few KB — plenty for a regional overview map.
  ["polygon_threshold", "0.001"],
];

async function nominatim(path: string, params: [string, string][]): Promise<unknown> {
  const url = new URL(`${config.geo.nominatimUrl}/${path}`);
  for (const [k, v] of [...params, ...GEOMETRY_PARAMS]) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nominatim ${path} failed (${res.status})`);
  return res.json();
}

// Municipality boundaries looked up by name, cached for the process lifetime
// (there are only a few hundred municipalities in Ontario).
const byName = new Map<string, ResolvedRegion | null>();

async function municipalityByName(
  name: string,
  county: string | null,
): Promise<ResolvedRegion | null> {
  const key = `${name}|${county ?? ""}`;
  if (byName.has(key)) return byName.get(key)!;
  const params: [string, string][] = [
    ["city", name],
    ["state", "Ontario"],
    ["country", "Canada"],
    ["limit", "5"],
  ];
  if (county) params.push(["county", county]);
  const results = (await nominatim("search.php", params)) as NominatimPlace[];
  // Unlike reverse, search results carry no name/addresstype here, so match
  // on the boundary itself and take the name we searched for.
  const match = results.find(
    (r) =>
      r.category === "boundary" &&
      r.type === "administrative" &&
      (r.place_rank ?? 0) >= MIN_MUNICIPAL_RANK,
  );
  const region = match ? toRegion({ ...match, name: match.name || name }) : null;
  byName.set(key, region);
  return region;
}

export async function resolveRegion(lat: number, lng: number): Promise<ResolvedRegion | null> {
  const d = (await nominatim("reverse.php", [
    ["lat", String(lat)],
    ["lon", String(lng)],
    ["zoom", "10"], // city / town level
  ])) as NominatimPlace;
  const outcome = classifyReverse(d);
  if (outcome.kind === "region") return outcome.region;
  if (outcome.kind === "parent") return municipalityByName(outcome.name, outcome.county);
  return null;
}

async function upsertRegion(r: ResolvedRegion, baseline = false): Promise<void> {
  await sql`
    INSERT INTO regions (id, name, county, geojson, baseline)
    VALUES (${r.id}, ${r.name}, ${r.county}, ${r.geojson === null ? null : sql.json(r.geojson as never)}, ${baseline})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      county = EXCLUDED.county,
      geojson = COALESCE(EXCLUDED.geojson, regions.geojson),
      baseline = regions.baseline OR EXCLUDED.baseline
  `;
}

// Resolve and store one order's pickup region. Never throws: analytics must
// not be able to break order placement. A geo outage leaves the order
// unchecked so the next backfill retries it.
export async function assignPickupRegion(orderId: string, lat: number, lng: number): Promise<void> {
  try {
    const region = await resolveRegion(lat, lng);
    if (region) await upsertRegion(region);
    await sql`
      UPDATE orders
      SET pickup_region_id = ${region?.id ?? null}, pickup_region_checked_at = now()
      WHERE id = ${orderId}
    `;
  } catch (err) {
    console.warn(`[regions] could not resolve pickup region for order ${orderId}:`, err);
  }
}

// Resolve regions for orders that predate this feature or were placed while
// Nominatim was down. Bounded per call so it can run on the analytics request
// path without stalling it.
export async function backfillPickupRegions(limit = 100): Promise<number> {
  const rows = await sql<{ id: string; pickup_lat: number; pickup_lng: number }[]>`
    SELECT id, pickup_lat, pickup_lng FROM orders
    WHERE pickup_region_checked_at IS NULL
      AND pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  const CONCURRENCY = 4;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows
        .slice(i, i + CONCURRENCY)
        .map((r) => assignPickupRegion(r.id, r.pickup_lat, r.pickup_lng)),
    );
  }
  return rows.length;
}

let baselineDone = false;

// Make sure every curated GTA/Hamilton region is stored with its boundary.
// Cheap after the first success (one COUNT), so it's safe to call per request.
export async function ensureBaselineRegions(): Promise<void> {
  if (baselineDone) return;
  const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM regions WHERE baseline`;
  if ((row?.n ?? 0) >= BASELINE_POINTS.length) {
    baselineDone = true;
    return;
  }
  for (const p of BASELINE_POINTS) {
    try {
      const region = await resolveRegion(p.lat, p.lng);
      if (region) {
        await upsertRegion(region, true);
      } else {
        console.warn(`[regions] baseline point for ${p.name} resolved to no region`);
      }
    } catch (err) {
      console.warn(`[regions] baseline lookup for ${p.name} failed:`, err);
      return; // Nominatim is down/importing — try again on a later request.
    }
  }
  // A full pass completed: points that resolved to nothing won't start
  // resolving on retry, so don't repeat the lookups on every request.
  baselineDone = true;
}
