import { describe, expect, test } from "bun:test";
import { formatOrderNumber, parseOrderSearch } from "./orderSearch.ts";

const parse = (qs: string) => parseOrderSearch(new URLSearchParams(qs));

describe("parseOrderSearch", () => {
  test("no params: every order, first page", () => {
    expect(parse("")).toEqual({ terms: [], from: null, to: null, page: 1 });
  });

  test("splits words into terms that must all match", () => {
    expect(parse("q=Ashley%20%20Bayview")).toMatchObject({ terms: ["Ashley", "Bayview"] });
  });

  test("a leading $ on a price is ignored so $32.30 finds 32.30", () => {
    expect(parse("q=%2432.30")).toMatchObject({ terms: ["32.30"] });
  });

  test("order numbers pass through as typed (CT-1001 or 1001)", () => {
    expect(parse("q=CT-1001")).toMatchObject({ terms: ["CT-1001"] });
    expect(parse("q=1001")).toMatchObject({ terms: ["1001"] });
  });

  test("LIKE wildcards are escaped so they're matched literally", () => {
    expect(parse("q=50%25%20a_b")).toMatchObject({ terms: ["50\\%", "a\\_b"] });
  });

  test("caps the number of terms", () => {
    const r = parse(`q=${Array.from({ length: 20 }, (_, i) => `w${i}`).join("%20")}`);
    expect("terms" in r && r.terms.length).toBe(8);
  });

  test("date range: both ends optional, YYYY-MM-DD", () => {
    expect(parse("from=2026-11-01&to=2027-02-01")).toMatchObject({
      from: "2026-11-01",
      to: "2027-02-01",
    });
    expect(parse("from=2026-11-01")).toMatchObject({ from: "2026-11-01", to: null });
    expect(parse("to=2027-02-01")).toMatchObject({ from: null, to: "2027-02-01" });
  });

  test("a one-day range is allowed (from = to)", () => {
    expect(parse("from=2026-11-24&to=2026-11-24")).toMatchObject({
      from: "2026-11-24",
      to: "2026-11-24",
    });
  });

  test("rejects From after To", () => {
    expect(parse("from=2027-02-01&to=2026-11-01")).toHaveProperty("error");
  });

  test("rejects badly formed or impossible dates", () => {
    for (const bad of ["October", "2026-11", "11/01/2026", "2026-02-30", "2026-13-01"]) {
      expect(parse(`from=${bad}`)).toHaveProperty("error");
      expect(parse(`to=${bad}`)).toHaveProperty("error");
    }
  });

  test("page must be a positive whole number", () => {
    expect(parse("page=3")).toMatchObject({ page: 3 });
    for (const bad of ["0", "-1", "1.5", "abc"]) {
      expect(parse(`page=${bad}`)).toHaveProperty("error");
    }
  });
});

test("formatOrderNumber", () => {
  expect(formatOrderNumber(1001)).toBe("CT-1001");
});
