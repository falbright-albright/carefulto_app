import { describe, expect, test } from "vitest";
import { money, STATUS_LABEL, STATUS_VARIANT } from "./format";

describe("format", () => {
  test("money formats CAD", () => {
    expect(money(12.5, "CAD")).toBe("$12.50");
  });

  test("every status has a label and a badge variant", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(Object.keys(STATUS_VARIANT).sort());
  });
});
