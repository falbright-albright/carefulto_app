import { describe, expect, test } from "vitest";
import {
  compact,
  minutes,
  money,
  monthLabel,
  monthRange,
  pctChange,
  STATUS_LABEL,
  STATUS_VARIANT,
} from "./format";

describe("format", () => {
  test("money formats CAD", () => {
    expect(money(12.5, "CAD")).toBe("$12.50");
  });

  test("every status has a label and a badge variant", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(Object.keys(STATUS_VARIANT).sort());
  });
});

describe("analytics formatting", () => {
  test("labels months", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthLabel("2026-07", "short")).toBe("Jul");
  });
  test("lists months newest first across a year boundary", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
  test("compacts only large numbers", () => {
    expect(compact(1284)).toBe("1,284");
    expect(compact(12_900)).toBe("12.9K");
  });
  test("computes relative change, with no baseline as null", () => {
    expect(pctChange(120, 100)).toBeCloseTo(0.2);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(null, 4)).toBeNull();
  });
  test("formats durations", () => {
    expect(minutes(40)).toBe("40 min");
    expect(minutes(95)).toBe("1 h 35 min");
    expect(minutes(120)).toBe("2 h");
  });
});
