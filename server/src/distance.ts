import { config } from "./config.ts";

// ---------------------------------------------------------------------------
// Distance provider abstraction. Swap providers by implementing this interface
// and pointing DISTANCE_PROVIDER at it. Currently: OpenRouteService (real road
// distance + geocoding, free key, no credit card).
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  source: string; // "ors"
}

// Thrown when we cannot compute a distance (no key, geocode miss, API down).
// The caller can then fall back to asking the customer for a manual distance.
export class DistanceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistanceUnavailableError";
  }
}

export interface DistanceProvider {
  readonly name: string;
  readonly configured: boolean;
  quote(pickupAddress: string, dropoffAddress: string): Promise<DistanceResult>;
}

// --- OpenRouteService implementation -------------------------------------

const ORS_BASE = "https://api.openrouteservice.org";

class OpenRouteServiceProvider implements DistanceProvider {
  readonly name = "ors";
  constructor(private apiKey: string) {}

  get configured() {
    return this.apiKey.length > 0;
  }

  private async geocode(address: string): Promise<GeoPoint> {
    const url = new URL(`${ORS_BASE}/geocode/search`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("text", address);
    url.searchParams.set("size", "1");
    url.searchParams.set("boundary.country", "CA");

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new DistanceUnavailableError(`Geocoding failed (${res.status}) for "${address}"`);
    }
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) {
      throw new DistanceUnavailableError(`No location found for "${address}"`);
    }
    // GeoJSON is [lng, lat].
    return { lng: coords[0], lat: coords[1] };
  }

  private async roadDistanceKm(from: GeoPoint, to: GeoPoint): Promise<number> {
    const res = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
    });
    if (!res.ok) {
      throw new DistanceUnavailableError(`Routing failed (${res.status})`);
    }
    const data = (await res.json()) as {
      routes?: { summary?: { distance?: number } }[];
    };
    const meters = data.routes?.[0]?.summary?.distance;
    if (meters === undefined) {
      throw new DistanceUnavailableError("No route found between the two addresses");
    }
    return Math.round((meters / 1000) * 100) / 100;
  }

  async quote(pickupAddress: string, dropoffAddress: string): Promise<DistanceResult> {
    if (!this.configured) {
      throw new DistanceUnavailableError("OpenRouteService API key is not configured");
    }
    const [pickup, dropoff] = await Promise.all([
      this.geocode(pickupAddress),
      this.geocode(dropoffAddress),
    ]);
    const distanceKm = await this.roadDistanceKm(pickup, dropoff);
    return { distanceKm, pickup, dropoff, source: this.name };
  }
}

export const distanceProvider: DistanceProvider = new OpenRouteServiceProvider(
  config.distance.orsApiKey,
);
