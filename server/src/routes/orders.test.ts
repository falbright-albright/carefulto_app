import { afterEach, describe, expect, mock, test } from "bun:test";
import { config } from "../config.ts";
import { priceForDistance } from "../pricing.ts";
import { quote } from "./orders.ts";

const post = (body: unknown) =>
  new Request("http://localhost/api/orders/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Two Toronto points.
const PINS = { pickupLat: 43.6426, pickupLng: -79.3871, dropoffLat: 43.6677, dropoffLng: -79.3948 };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function fakeOsrm(response: Response | Error) {
  globalThis.fetch = mock(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
}

describe("POST /api/orders/quote", () => {
  test("rejects a request without pin coordinates (address text alone isn't enough)", async () => {
    const res = await quote(post({ pickupAddress: "a", dropoffAddress: "b" }));
    expect(res.status).toBe(400);
  });

  test("rejects coordinates outside Ontario", async () => {
    const res = await quote(post({ ...PINS, pickupLat: 49.28, pickupLng: -123.12 }));
    expect(res.status).toBe(400);
  });

  test("prices from the OSRM driving distance", async () => {
    fakeOsrm(
      Response.json({
        routes: [
          {
            distance: 30000, // 30 km
            duration: 1800,
            geometry: {
              coordinates: [
                [-79.3871, 43.6426],
                [-79.3948, 43.6677],
              ],
            },
          },
        ],
      }),
    );
    const res = await quote(post(PINS));
    expect(res.status).toBe(200);
    const q = (await res.json()) as {
      distanceKm: number;
      source: string;
      price: number;
      currency: string;
      geometry: [number, number][];
    };
    expect(q.distanceKm).toBe(30);
    expect(q.source).toBe("osrm");
    expect(q.price).toBe(priceForDistance(30)); // max(min, base + perKm * 30)
    expect(q.currency).toBe(config.pricing.currency);
    expect(q.geometry[0]).toEqual([43.6426, -79.3871]);
  });

  test("returns 502 (no manual-distance fallback) when OSRM is unreachable", async () => {
    fakeOsrm(new Error("connect ECONNREFUSED"));
    const res = await quote(post(PINS));
    expect(res.status).toBe(502);
  });
});
