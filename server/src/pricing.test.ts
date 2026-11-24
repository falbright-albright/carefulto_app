import { expect, test } from "bun:test";
import { config } from "./config.ts";
import { priceForDistance } from "./pricing.ts";

test("never goes below the minimum price", () => {
  expect(priceForDistance(0)).toBeGreaterThanOrEqual(config.pricing.min);
});

test("rounds to cents", () => {
  const p = priceForDistance(7.3333);
  expect(Math.round(p * 100) / 100).toBe(p);
});
