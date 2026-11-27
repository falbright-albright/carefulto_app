import { describe, expect, test } from "bun:test";
import {
  formatRequestRef,
  MESSAGE_MAX,
  parseMessage,
  parseNewRequest,
  redactForCustomer,
  SUBJECT_MAX,
  type SupportMessageView,
} from "./support.ts";

const ORDER = "6f1c2b8e-3c1a-4a51-9a9e-0c4b1f2e7d10";
const base = { subject: "Late delivery", message: "It arrived two hours late." };

describe("parseNewRequest", () => {
  test("accepts a question with no order", () => {
    expect(parseNewRequest({ ...base, kind: "question" })).toEqual({
      kind: "question",
      orderId: null,
      subject: "Late delivery",
      message: "It arrived two hours late.",
    });
  });

  test("trims subject and message", () => {
    const r = parseNewRequest({ kind: "comment", subject: "  Hi ", message: "\n Thanks!  " });
    expect(r).toMatchObject({ subject: "Hi", message: "Thanks!" });
  });

  test("delivery and courier complaints need an order", () => {
    for (const kind of ["delivery", "courier"]) {
      expect(parseNewRequest({ ...base, kind })).toEqual({
        error: "choose the order this is about",
      });
      expect(parseNewRequest({ ...base, kind, orderId: "" })).toHaveProperty("error");
      expect(parseNewRequest({ ...base, kind, orderId: ORDER })).toMatchObject({
        kind,
        orderId: ORDER,
      });
    }
  });

  test("a question may optionally name an order", () => {
    expect(parseNewRequest({ ...base, kind: "question", orderId: ORDER })).toMatchObject({
      orderId: ORDER,
    });
  });

  test("rejects unknown kinds and malformed order ids", () => {
    expect(parseNewRequest({ ...base, kind: "refund" })).toHaveProperty("error");
    expect(parseNewRequest({ ...base })).toHaveProperty("error");
    expect(parseNewRequest({ ...base, kind: "delivery", orderId: "CT-1001" })).toEqual({
      error: "orderId is not a valid order",
    });
    expect(parseNewRequest({ ...base, kind: "delivery", orderId: 42 })).toHaveProperty("error");
  });

  test("requires a subject and message within the limits", () => {
    expect(parseNewRequest({ kind: "question", subject: " ", message: "x" })).toEqual({
      error: "subject is required",
    });
    expect(parseNewRequest({ kind: "question", subject: "x", message: "" })).toEqual({
      error: "message is required",
    });
    expect(
      parseNewRequest({ kind: "question", subject: "x".repeat(SUBJECT_MAX + 1), message: "x" }),
    ).toHaveProperty("error");
    expect(
      parseNewRequest({ kind: "question", subject: "x".repeat(SUBJECT_MAX), message: "x" }),
    ).not.toHaveProperty("error");
  });
});

describe("parseMessage", () => {
  test("enforces the length limit", () => {
    expect(parseMessage("x".repeat(MESSAGE_MAX))).toEqual({ body: "x".repeat(MESSAGE_MAX) });
    expect(parseMessage("x".repeat(MESSAGE_MAX + 1))).toHaveProperty("error");
    expect(parseMessage(undefined)).toEqual({ error: "message is required" });
  });
});

test("formatRequestRef", () => {
  expect(formatRequestRef(1001)).toBe("RQ-1001");
});

test("customers see admin replies as CarefulTO Support", () => {
  const msgs: SupportMessageView[] = [
    { id: "1", authorId: "c", authorName: "Pat", authorRole: "customer", body: "a", createdAt: "" },
    {
      id: "2",
      authorId: "a",
      authorName: "Sam Admin",
      authorRole: "admin",
      body: "b",
      createdAt: "",
    },
  ];
  const out = redactForCustomer(msgs);
  expect(out[0]).toEqual(msgs[0]!);
  expect(out[1]).toMatchObject({ authorId: "", authorName: "CarefulTO Support", body: "b" });
});
