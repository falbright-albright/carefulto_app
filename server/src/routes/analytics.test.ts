import { describe, expect, test } from "bun:test";
import {
  currentMonth,
  formatMonth,
  overview,
  parseMonth,
  regions,
  shiftMonth,
} from "./analytics.ts";

describe("month helpers", () => {
  test("parseMonth accepts YYYY-MM only", () => {
    expect(parseMonth("2026-07")).toEqual({ year: 2026, month: 7 });
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-7")).toBeNull();
    expect(parseMonth("july")).toBeNull();
    expect(parseMonth(null)).toBeNull();
  });

  test("shiftMonth crosses year boundaries both ways", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 11 }, -11)).toEqual({ year: 2025, month: 12 });
  });

  test("formatMonth zero-pads", () => {
    expect(formatMonth({ year: 2026, month: 3 })).toBe("2026-03");
  });

  test("currentMonth uses the business time zone, not UTC", () => {
    // 02:00 UTC on Aug 1 is still July 31 in Toronto.
    const t = new Date("2026-08-01T02:00:00Z");
    expect(currentMonth(t, "America/Toronto")).toEqual({ year: 2026, month: 7 });
    expect(currentMonth(t, "UTC")).toEqual({ year: 2026, month: 8 });
  });
});

describe("analytics endpoints reject bad months before touching the database", () => {
  test("overview", async () => {
    const res = await overview(new Request("http://localhost/api/admin/analytics?month=2026-99"));
    expect(res.status).toBe(400);
  });
  test("regions", async () => {
    const res = await regions(
      new Request("http://localhost/api/admin/analytics/regions?month=nope"),
    );
    expect(res.status).toBe(400);
  });
});
