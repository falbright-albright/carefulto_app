import { json } from "../http.ts";
import { ITEM_CATEGORIES } from "../categories.ts";
import { config } from "../config.ts";
import { distanceProvider } from "../distance.ts";

// GET /api/categories
export async function categories(): Promise<Response> {
  return json({ categories: ITEM_CATEGORIES });
}

// GET /api/config  — public app config for the frontend.
export async function appConfig(): Promise<Response> {
  return json({
    pricing: config.pricing,
    distance: {
      provider: distanceProvider.name,
      configured: distanceProvider.configured,
    },
  });
}
