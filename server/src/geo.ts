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
  const url = new URL(`${config.geo.nominatimUrl}/search`);
  url.searchParams.set("q", queryText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ca");
  url.searchParams.set("viewbox", config.geo.ontarioViewbox);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "8");

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
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
