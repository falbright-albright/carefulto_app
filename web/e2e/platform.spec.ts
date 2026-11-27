import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

// Signed-in platform checks. Need the default admin from the server's boot
// seed; CI sets these to match. Override with E2E_ADMIN_EMAIL/PASSWORD.
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@careful2.ca",
  password: process.env.E2E_ADMIN_PASSWORD ?? "changeme123",
};
const PASSWORD = "e2e-password-123";

async function ensureAccounts(request: APIRequestContext) {
  const id = Date.now().toString(36);
  const customer = { email: `customer-${id}@e2e.test`, password: PASSWORD };
  const courier = { email: `courier-${id}@e2e.test`, password: PASSWORD };
  // Long-ish names on purpose: the header must still fit on a phone.
  const reg = await request.post("/api/auth/register", {
    data: { ...customer, name: "Alexandra Customer-Smith" },
  });
  expect(reg.ok()).toBeTruthy();
  // The API uses bearer tokens (the web app keeps one in localStorage).
  const login = await request.post("/api/auth/login", { data: ADMIN });
  expect(login.ok()).toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  const made = await request.post("/api/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...courier, name: "Maximilian Courier", role: "courier" },
  });
  expect(made.ok()).toBeTruthy();
  return { customer, courier };
}

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(who.email);
  await page.getByLabel(/password/i).fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app");
}

test("the app header fits a 375px phone for every role", async ({ page, request }) => {
  const { customer, courier } = await ensureAccounts(request);
  await page.setViewportSize({ width: 375, height: 800 });

  for (const who of [ADMIN, courier, customer]) {
    await signIn(page, who);
    const logOut = page.getByRole("button", { name: "Log out" });
    await expect(logOut).toBeVisible();

    const m = await page.evaluate(() => {
      const header = document.querySelector("header")!;
      const box = header.firstElementChild!.getBoundingClientRect();
      const pad = Number.parseFloat(getComputedStyle(header.firstElementChild!).paddingRight);
      const right = Math.max(
        ...[...header.querySelectorAll("button, a, span")].map(
          (e) => e.getBoundingClientRect().right,
        ),
      );
      return {
        right,
        contentEdge: box.right - pad,
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
      };
    });
    // Nothing in the header pokes past the page's content edge or the screen.
    expect(m.right).toBeLessThanOrEqual(m.contentEdge + 0.5);
    expect(m.scroll).toBeLessThanOrEqual(m.width);

    await logOut.click();
    await page.waitForURL((u) => u.pathname === "/");
  }
});

test("Log out keeps its label on wider screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, ADMIN);
  await expect(page.getByRole("button", { name: "Log out" })).toContainText("Log out");
});
