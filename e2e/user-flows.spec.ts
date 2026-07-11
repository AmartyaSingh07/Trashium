import { expect, test, type Page } from "@playwright/test";

const householdEmail = process.env.E2E_HOUSEHOLD_EMAIL;
const householdPassword = process.env.E2E_HOUSEHOLD_PASSWORD;
const lockedEmail = process.env.E2E_LOCKED_EMAIL;
const lockedPassword = process.env.E2E_LOCKED_PASSWORD;
const unlockedEmail = process.env.E2E_UNLOCKED_EMAIL;
const unlockedPassword = process.env.E2E_UNLOCKED_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("protected household pages redirect guests to login", async ({ page }) => {
  for (const path of ["/dashboard", "/marketplace"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("unauthenticated admin access redirects to login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("non-admin household is redirected away from admin", async ({ page }) => {
  test.skip(!householdEmail || !householdPassword, "Set E2E_HOUSEHOLD_EMAIL and E2E_HOUSEHOLD_PASSWORD.");

  await login(page, householdEmail!, householdPassword!);
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("household pickup form opens and validates required fields", async ({ page }) => {
  test.skip(!householdEmail || !householdPassword, "Set E2E_HOUSEHOLD_EMAIL and E2E_HOUSEHOLD_PASSWORD.");

  await login(page, householdEmail!, householdPassword!);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /schedule a pickup/i }).first().click();

  await expect(page.getByRole("dialog", { name: "Schedule a Pickup" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Pickup" }).click();
  await expect(page.getByText("Select at least one material.")).toBeVisible();
});

test("marketplace shows locked gate for a locked household", async ({ page }) => {
  test.skip(!lockedEmail || !lockedPassword, "Set E2E_LOCKED_EMAIL and E2E_LOCKED_PASSWORD.");

  await login(page, lockedEmail!, lockedPassword!);
  await page.goto("/marketplace");

  await expect(page.getByRole("heading", { name: "The marketplace unlocks soon" })).toBeVisible();
  await expect(page.getByText("Reach 500 Green Credits")).toBeVisible();
  await expect(page.getByText("Complete at least 1 pickup")).toBeVisible();
});

test("marketplace catalog is visible for an unlocked household", async ({ page }) => {
  test.skip(!unlockedEmail || !unlockedPassword, "Set E2E_UNLOCKED_EMAIL and E2E_UNLOCKED_PASSWORD.");

  await login(page, unlockedEmail!, unlockedPassword!);
  await page.goto("/marketplace");

  await expect(page.getByRole("heading", { name: "Trashium Marketplace" })).toBeVisible();
  await expect(page.getByText("The marketplace unlocks soon")).toHaveCount(0);
  await expect(page.getByText(/Redeem|Locked/).first()).toBeVisible();
});

test("language preference changes the public page locale", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "hi",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByLabel("Switch language").first()).toContainText("हि");
});
