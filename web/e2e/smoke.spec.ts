import { expect, test } from "@playwright/test";

test("login page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
});
