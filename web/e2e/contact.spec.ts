import { expect, type Page, test } from "@playwright/test";

// "Contact us": a customer sends a question, an admin replies and resolves
// it, and the customer sees the reply. Uses the boot-seeded admin (see
// platform.spec.ts). Orders aren't placed here: CI has no routing service to
// price them, so order-linked complaints are covered by the server's
// support.integration.test.ts.
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@careful2.ca",
  password: process.env.E2E_ADMIN_PASSWORD ?? "changeme123",
};

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(who.email);
  await page.getByLabel(/password/i).fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app");
}

const literal = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("a customer's question is answered and resolved by an admin", async ({ page, request }) => {
  const id = Date.now().toString(36);
  const customer = { email: `contact-${id}@e2e.test`, password: "e2e-password-123" };
  const reg = await request.post("/api/auth/register", {
    data: { ...customer, name: "Casey Contact" },
  });
  expect(reg.ok()).toBeTruthy();
  const subject = `Sunday deliveries? ${id}`;

  // Customer: Contact us -> question. All three tabs fit a phone.
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, customer);
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab", { name: "Contact us" })).toBeVisible();
  const right = await tabs.evaluate((el) => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await tabs.getByRole("tab", { name: "Contact us" }).click();
  await expect(page).toHaveURL(/tab=contact/);
  await page.getByText("A question", { exact: true }).click();
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("Message").fill("Do you deliver on Sundays?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Thanks, we've got it.")).toBeVisible();
  await expect(page.getByText("We'll reply within 24 hours.")).toBeVisible();
  const ref = await page
    .locator("span.font-mono", { hasText: /^RQ-\d+$/ })
    .first()
    .innerText();
  await expect(page.getByRole("link", { name: literal(subject) })).toBeVisible();
  await signOut(page);

  // Admin: finds it in the Requests tab, replies and resolves.
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, ADMIN);
  await page.getByRole("tab", { name: /Requests/ }).click();
  await page.getByRole("link", { name: literal(subject) }).click();
  await expect(page.getByText("Do you deliver on Sundays?")).toBeVisible();
  await expect(page.getByText("Casey Contact").first()).toBeVisible();
  await page.getByLabel(/Reply to Casey Contact/).fill("Yes, 9am to 5pm on Sundays.");
  await page.getByRole("button", { name: "Send & resolve" }).click();
  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Back to requests" }).click();
  await expect(page.getByRole("tab", { name: /Requests/ })).toHaveAttribute("data-state", "active");
  await signOut(page);

  // Customer: notified, sees the reply signed by support (not the admin's name).
  await signIn(page, customer);
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("link", { name: new RegExp(`${ref}.*marked resolved`) }).click();
  await expect(page.getByText("Yes, 9am to 5pm on Sundays.")).toBeVisible();
  const convo = page.getByRole("list", { name: "Conversation" });
  await expect(convo.getByText("CarefulTO Support")).toBeVisible();
  await expect(convo.getByText("Yes, 9am to 5pm on Sundays.")).toBeVisible();
  await expect(page.getByText("Replying will reopen it.")).toBeVisible();
});
