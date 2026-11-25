import { expect, test } from "bun:test";
import { config } from "./config.ts";
import { priceForDistance } from "./pricing.ts";

test("never goes below the minimum price", () => {
  expect(priceForDistance(0)).toBe(config.pricing.min);
});

test("minimum delivery price defaults to $20", () => {
  // Only meaningful when PRICE_MIN isn't overridden in the test environment.
  if (process.env.PRICE_MIN === undefined) expect(config.pricing.min).toBe(20);
});

test("charges base + per-km above the minimum", () => {
  const { base, perKm, min } = config.pricing;
  const km = (min - base) / perKm + 10; // comfortably above the minimum
  expect(priceForDistance(km)).toBeCloseTo(base + perKm * km, 2);
});

test("rounds to cents", () => {
  const p = priceForDistance(7.3333);
  expect(Math.round(p * 100) / 100).toBe(p);
});
