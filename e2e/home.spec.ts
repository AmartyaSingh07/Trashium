import { expect, test } from "@playwright/test";

test("public home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Trashium/i);
  await expect(page.locator("body")).toBeVisible();
});
