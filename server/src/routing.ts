import { config } from "./config.ts";

// ---------------------------------------------------------------------------
// Driving routes, backed by a self-hosted OSRM instance built from the same
// Ontario-only extract as Nominatim (see docker-compose.yml). This is the
// single source of road distance: it prices orders (routes/orders.ts) and
// draws the route line on the map. Nothing external is called.
// ---------------------------------------------------------------------------

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][]; // [lat, lng] pairs, in travel order
}

const [minLng = Number.NaN, minLat = Number.NaN, maxLng = Number.NaN, maxLat = Number.NaN] =
  config.geo.ontarioViewbox.split(",").map(Number);

// OSRM doesn't error on an out-of-region point — it silently snaps it to the
// nearest road in whatever's loaded (here, Ontario only), which for a point
// nowhere near Ontario can produce a nonsensical degenerate route. Callers
// reject such points up front with the same box autocomplete is limited to.
export function withinOntario({ lat, lng }: RoutePoint): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

export class RouteUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteUnavailableError";
  }
}

export async function route(pickup: RoutePoint, dropoff: RoutePoint): Promise<RouteResult> {
  const url =
    `${config.geo.osrmUrl}/route/v1/driving/` +
    `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}` +
    `?overview=full&geometries=geojson`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new RouteUnavailableError(
      `Could not reach the routing service: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new RouteUnavailableError(`Routing failed (${res.status})`);
  }

  const data = (await res.json()) as {
    routes?: {
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: [number, number][] };
    }[];
  };
  const r = data.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (!r || r.distance === undefined || r.duration === undefined || !coords) {
    throw new RouteUnavailableError("No route found between the two points");
  }

  return {
    distanceKm: Math.round((r.distance / 1000) * 100) / 100,
    durationMin: Math.round((r.duration / 60) * 10) / 10,
    // GeoJSON is [lng, lat] — flip to [lat, lng] for Leaflet.
    geometry: coords.map(([lng, lat]) => [lat, lng]),
  };
}
