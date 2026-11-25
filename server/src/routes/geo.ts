import { json, error } from "../http.ts";
import { autocomplete, GeoUnavailableError } from "../geo.ts";
import { route, RouteUnavailableError } from "../routing.ts";
import { config } from "../config.ts";

const [minLng, minLat, maxLng, maxLat] = config.geo.ontarioViewbox.split(",").map(Number);

// OSRM doesn't error on an out-of-region point — it silently snaps it to the
// nearest road in whatever's loaded (here, Ontario only), which for a point
// nowhere near Ontario can produce a nonsensical degenerate "route". Reject
// up front using the same bounding box autocomplete is already limited to.
function withinOntario(lat: number, lng: number): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// GET /api/geo/autocomplete?q=...  — Ontario-bounded address suggestions.
export async function getAutocomplete(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return json({ suggestions: [] });

  try {
    const suggestions = await autocomplete(q);
    return json({ suggestions });
  } catch (err) {
    if (err instanceof GeoUnavailableError) {
      return error(err.message, 502);
    }
    throw err;
  }
}

// GET /api/geo/route?pickupLat=&pickupLng=&dropoffLat=&dropoffLng=
// Driving route preview between two known points. Informational only — not
// used for pricing, which stays on the existing OpenRouteService quote.
export async function getRoute(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  // Number(null) is 0, not NaN — a missing param would otherwise silently
  // become a bogus-but-"valid" (0, 0)-ish coordinate instead of a 400.
  const raw = {
    pickupLat: params.get("pickupLat"),
    pickupLng: params.get("pickupLng"),
    dropoffLat: params.get("dropoffLat"),
    dropoffLng: params.get("dropoffLng"),
  };
  if (Object.values(raw).some((v) => v === null || v.trim() === "")) {
    return error("pickupLat, pickupLng, dropoffLat and dropoffLng are required");
  }
  const pickupLat = Number(raw.pickupLat);
  const pickupLng = Number(raw.pickupLng);
  const dropoffLat = Number(raw.dropoffLat);
  const dropoffLng = Number(raw.dropoffLng);
  if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every(Number.isFinite)) {
    return error("pickupLat, pickupLng, dropoffLat and dropoffLng are required numbers");
  }
  if (!withinOntario(pickupLat, pickupLng) || !withinOntario(dropoffLat, dropoffLng)) {
    return error("coordinates must be within Ontario");
  }

  try {
    const result = await route(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
    );
    return json(result);
  } catch (err) {
    if (err instanceof RouteUnavailableError) {
      return error(err.message, 502);
    }
    throw err;
  }
}
