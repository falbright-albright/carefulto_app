import { describe, expect, test } from "vitest";
import { deliveryDirectionsUrl } from "./googleMaps";

const pickup = { address: "2901 Bayview Ave, Toronto", lat: 43.7684461, lng: -79.3862454 };
const dropoff = { address: "62 Glen Everest Rd, Toronto", lat: 43.70252, lng: -79.25307 };
const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("deliveryDirectionsUrl", () => {
  test("with the courier's location: here → pickup (stop) → drop-off, driving", () => {
    const url = deliveryDirectionsUrl(pickup, dropoff, { lat: 43.65, lng: -79.38 });
    expect(url.startsWith("https://www.google.com/maps/dir/?")).toBe(true);
    expect(params(url)).toEqual({
      api: "1",
      travelmode: "driving",
      origin: "43.65,-79.38",
      waypoints: "43.7684461,-79.3862454",
      destination: "43.70252,-79.25307",
    });
  });

  test("without a location: pickup → drop-off, no stops", () => {
    const p = params(deliveryDirectionsUrl(pickup, dropoff, null));
    expect(p.origin).toBe("43.7684461,-79.3862454");
    expect(p.destination).toBe("43.70252,-79.25307");
    expect(p.waypoints).toBeUndefined();
  });

  test("old orders without pins use the address text", () => {
    const p = params(
      deliveryDirectionsUrl(
        { address: "100 Queen St W, Toronto", lat: null, lng: null },
        { address: "1 Yonge St, Toronto", lat: null, lng: null },
      ),
    );
    expect(p.origin).toBe("100 Queen St W, Toronto");
    expect(p.destination).toBe("1 Yonge St, Toronto");
  });
});
