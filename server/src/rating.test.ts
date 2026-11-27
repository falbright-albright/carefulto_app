import { describe, expect, test } from "bun:test";
import { parseRating, RATING_COMMENT_MAX } from "./rating.ts";

describe("parseRating", () => {
  test("rating and comment are both optional", () => {
    expect(parseRating({})).toEqual({ rating: null, comment: null });
    expect(parseRating({ rating: null, comment: null })).toEqual({ rating: null, comment: null });
  });

  test("accepts 1 to 5 whole stars", () => {
    for (const n of [1, 2, 3, 4, 5])
      expect(parseRating({ rating: n })).toEqual({ rating: n, comment: null });
  });

  test("rejects out-of-range, fractional and non-numeric ratings", () => {
    for (const r of [0, 6, -1, 3.5, "4", true])
      expect(parseRating({ rating: r })).toHaveProperty("error");
  });

  test("trims the comment and drops a blank one", () => {
    expect(parseRating({ rating: 5, comment: "  Great  " })).toEqual({
      rating: 5,
      comment: "Great",
    });
    expect(parseRating({ rating: 5, comment: "   " })).toEqual({ rating: 5, comment: null });
  });

  test("rejects an over-long or non-text comment", () => {
    expect(parseRating({ rating: 4, comment: "x".repeat(RATING_COMMENT_MAX + 1) })).toHaveProperty(
      "error",
    );
    expect(parseRating({ rating: 4, comment: 42 })).toHaveProperty("error");
  });

  test("a comment needs stars", () => {
    expect(parseRating({ comment: "Late" })).toHaveProperty("error");
  });
});
