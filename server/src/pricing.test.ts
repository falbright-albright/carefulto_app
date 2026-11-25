import { expect, test } from "bun:test";
import { config } from "./config.ts";
import { priceForDistance } from "./pricing.ts";

test("never goes below the minimum price", () => {
  expect(priceForDistance(0)).toBe(config.pricing.min);
});

test("minimum delivery price defaults to $15", () => {
  // Only meaningful when PRICE_MIN isn't overridden in the test environment.
  if (process.env.PRICE_MIN === undefined) expect(config.pricing.min).toBe(15);
});

test("per-km rate defaults to $1.75", () => {
  // Only meaningful when PRICE_PER_KM isn't overridden in the test environment.
  if (process.env.PRICE_PER_KM === undefined) expect(config.pricing.perKm).toBe(1.75);
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
