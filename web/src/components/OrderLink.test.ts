import { afterEach, describe, expect, test } from "vitest";
import { shouldOpenOrder } from "./OrderLink";

function card(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("shouldOpenOrder", () => {
  test("opens when clicking plain text in the card", () => {
    const c = card(`<p id="t">62 Glen Everest Road</p>`);
    expect(shouldOpenOrder(c, c.querySelector("#t"))).toBe(true);
  });

  test("buttons inside the card keep their own action (Accept, Verify, Recommend)", () => {
    const c = card(`<button><svg id="icon"></svg> Accept</button>`);
    expect(shouldOpenOrder(c, c.querySelector("button"))).toBe(false);
    expect(shouldOpenOrder(c, c.querySelector("#icon"))).toBe(false);
  });

  test("the title link handles its own navigation", () => {
    const c = card(`<a href="/orders/1">Furniture</a>`);
    expect(shouldOpenOrder(c, c.querySelector("a"))).toBe(false);
  });

  test("ignores clicks from portals outside the card (e.g. the Recommend dialog)", () => {
    const c = card(`<p>row</p>`);
    const dialog = card(`<div role="dialog"><p id="d">Choose a courier</p></div>`);
    expect(shouldOpenOrder(c, dialog.querySelector("#d"))).toBe(false);
  });

  test("doesn't navigate while the user is selecting text", () => {
    const c = card(`<p id="t">2901 Bayview Avenue</p>`);
    const range = document.createRange();
    range.selectNodeContents(c.querySelector("#t") as Node);
    window.getSelection()?.addRange(range);
    expect(shouldOpenOrder(c, c.querySelector("#t"))).toBe(false);
  });
});
