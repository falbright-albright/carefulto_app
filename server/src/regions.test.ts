import { describe, expect, test } from "bun:test";
import { classifyReverse } from "./regions.ts";

// Shapes below are trimmed from real responses of the self-hosted Ontario
// Nominatim (reverse.php, zoom=10).
const poly = { type: "Polygon", coordinates: [] };

describe("classifyReverse", () => {
  test("uses an administrative municipality boundary directly", () => {
    const out = classifyReverse({
      osm_type: "relation",
      osm_id: 1954127,
      name: "Mississauga",
      category: "boundary",
      type: "administrative",
      addresstype: "city",
      place_rank: 16,
      address: { city: "Mississauga", county: "Peel Region" },
      geojson: poly,
    });
    expect(out).toEqual({
      kind: "region",
      region: { id: "R1954127", name: "Mississauga", county: "Peel Region", geojson: poly },
    });
  });

  test("drops a county that just repeats the name (single-tier cities)", () => {
    const out = classifyReverse({
      osm_type: "relation",
      osm_id: 7034910,
      name: "Hamilton",
      category: "boundary",
      type: "administrative",
      addresstype: "city",
      place_rank: 12,
      address: { city: "Hamilton", county: "Hamilton" },
      geojson: poly,
    });
    expect(out.kind === "region" && out.region.county).toBeNull();
  });

  test("rolls a former Toronto borough up to the city", () => {
    const out = classifyReverse({
      osm_type: "relation",
      osm_id: 2989344,
      name: "North York",
      category: "boundary",
      type: "administrative",
      addresstype: "city_district",
      place_rank: 16,
      address: { city_district: "North York", city: "Toronto" },
    });
    expect(out).toEqual({ kind: "parent", name: "Toronto", county: null });
  });

  test("rolls a non-boundary place outline up to its municipality", () => {
    const out = classifyReverse({
      osm_type: "way",
      osm_id: 1499781347,
      name: "Markham",
      category: "place",
      type: "city",
      addresstype: "city",
      place_rank: 16,
      address: { city: "Markham", municipality: "Whitchurch-Stouffville", county: "York Region" },
    });
    expect(out).toEqual({ kind: "parent", name: "Markham", county: "York Region" });
  });

  test("a province-level hit (open water) is no region", () => {
    const out = classifyReverse({
      osm_type: "relation",
      osm_id: 68841,
      name: "Ontario",
      category: "boundary",
      type: "administrative",
      addresstype: "state",
      place_rank: 8,
      address: { state: "Ontario" },
    });
    expect(out).toEqual({ kind: "none" });
  });

  test("a Nominatim error is no region", () => {
    expect(classifyReverse({ error: "Unable to geocode" })).toEqual({ kind: "none" });
  });
});
