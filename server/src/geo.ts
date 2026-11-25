import { config } from "./config.ts";

// ---------------------------------------------------------------------------
// Address autocomplete, backed by a self-hosted Nominatim instance indexed
// only on an Ontario OSM extract (see docker-compose.yml + README "Geo
// services"). Results are also bounded by viewbox so nothing outside
// Ontario can be suggested even if the index ever grows.
// ---------------------------------------------------------------------------

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export class GeoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeoUnavailableError";
  }
}

export async function autocomplete(queryText: string): Promise<AddressSuggestion[]> {
  // search.php, not /search: Nominatim's Apache front-end resolves /search to
  // search.php via content-negotiation (MultiViews), which only registers a
  // text/html representation — an explicit Accept: application/json then
  // trips a 406. Hitting search.php directly skips that negotiation; the
  // response format is controlled by format=jsonv2 regardless.
  const url = new URL(`${config.geo.nominatimUrl}/search.php`);
  url.searchParams.set("q", queryText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ca");
  url.searchParams.set("viewbox", config.geo.ontarioViewbox);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "8");

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new GeoUnavailableError(
      `Could not reach the address service: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new GeoUnavailableError(`Address lookup failed (${res.status})`);
  }

  const data = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];

  return data
    .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
