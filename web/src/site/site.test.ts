import { describe, expect, test } from "vitest";
import { cancellationMailto } from "./CancelPage";

describe("cancellation email", () => {
  test("goes to info@carefulto.ca with the booking details filled in", () => {
    const url = cancellationMailto({
      ref: "CS3K9X2A",
      name: "Jane Smith",
      email: "jane@example.com",
      reason: "",
    });
    expect(url.startsWith("mailto:info@carefulto.ca?")).toBe(true);
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("subject")).toBe("Cancellation request — CS3K9X2A");
    expect(q.get("body")).toContain("Booking reference: CS3K9X2A");
    expect(q.get("body")).toContain("Email: jane@example.com");
    expect(q.get("body")).toContain("Reason: (not given)");
  });
});
