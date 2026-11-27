import { describe, expect, test } from "bun:test";
import { formatOrderNumber, parseOrderSearch } from "./orderSearch.ts";

const parse = (qs: string) => parseOrderSearch(new URLSearchParams(qs));

describe("parseOrderSearch", () => {
  test("no params: every order, first page", () => {
    expect(parse("")).toEqual({ terms: [], month: null, page: 1 });
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

  test("month must be YYYY-MM", () => {
    expect(parse("month=2026-11")).toMatchObject({ month: "2026-11" });
    expect(parse("month=2026-13")).toHaveProperty("error");
    expect(parse("month=November")).toHaveProperty("error");
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
