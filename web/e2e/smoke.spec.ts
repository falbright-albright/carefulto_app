import { expect, test } from "@playwright/test";

test("landing page loads with the CarefulTO hero and sign-in menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We Deliver What");
  await page.getByRole("button", { name: "Sign in" }).click();
  for (const door of ["Customer", "Courier", "Admin"]) {
    await expect(page.getByRole("menuitem", { name: new RegExp(`^${door}`) })).toBeVisible();
  }
});

test("sign-in page loads", async ({ page }) => {
  await page.goto("/login?as=courier");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("site pages linked from the footer load", async ({ page }) => {
  for (const [path, heading] of [
    ["/support", "Customer Support"],
    ["/terms", "Terms of Service"],
    ["/privacy", "Privacy"],
    ["/cancel", "Cancel a Booking"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }
});
