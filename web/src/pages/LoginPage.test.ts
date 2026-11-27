import { describe, expect, test } from "vitest";
import { ApiError } from "@/lib/api";
import { loginErrorMessage } from "./LoginPage";

describe("loginErrorMessage", () => {
  test("wrong email or password (401) says so plainly", () => {
    expect(loginErrorMessage(new ApiError(401, "invalid email or password", {}))).toBe(
      "Incorrect email or password. Please try again.",
    );
  });

  test("banned account (403) is explained", () => {
    expect(loginErrorMessage(new ApiError(403, "this account has been banned", {}))).toMatch(
      /suspended/,
    );
  });

  test("network failure gets a connection message", () => {
    expect(loginErrorMessage(new TypeError("Failed to fetch"))).toMatch(/connection/);
  });
});
