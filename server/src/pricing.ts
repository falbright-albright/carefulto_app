import { config } from "./config.ts";

// price = max(min, base + perKm * distanceKm), rounded to cents.
export function priceForDistance(distanceKm: number): number {
  const { base, perKm, min } = config.pricing;
  const raw = base + perKm * distanceKm;
  const price = Math.max(min, raw);
  return Math.round(price * 100) / 100;
}
