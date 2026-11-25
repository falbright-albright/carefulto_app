import { json, error } from "../http.ts";
import { autocomplete, GeoUnavailableError } from "../geo.ts";
import { route, RouteUnavailableError, withinOntario } from "../routing.ts";

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
// Driving route between two known points (same OSRM call that prices orders).
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
  if (
    !withinOntario({ lat: pickupLat, lng: pickupLng }) ||
    !withinOntario({ lat: dropoffLat, lng: dropoffLng })
  ) {
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
