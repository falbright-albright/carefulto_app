import { json, error } from "../http.ts";
import { autocomplete, GeoUnavailableError } from "../geo.ts";

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
