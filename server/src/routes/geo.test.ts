import { describe, expect, test } from "bun:test";
import { getRoute } from "./geo.ts";

const req = (qs: string) => new Request(`http://localhost/api/geo/route?${qs}`);

describe("GET /api/geo/route validation", () => {
  test("rejects a missing param instead of treating it as 0", async () => {
    const res = await getRoute(req("pickupLat=43.65&pickupLng=-79.38&dropoffLat=43.7"));
    expect(res.status).toBe(400);
  });

  test("rejects non-numeric coordinates", async () => {
    const res = await getRoute(
      req("pickupLat=abc&pickupLng=-79.38&dropoffLat=43.7&dropoffLng=-79.4"),
    );
    expect(res.status).toBe(400);
  });

  test("rejects coordinates outside Ontario", async () => {
    // Vancouver
    const res = await getRoute(
      req("pickupLat=49.28&pickupLng=-123.12&dropoffLat=43.7&dropoffLng=-79.4"),
    );
    expect(res.status).toBe(400);
  });
});
