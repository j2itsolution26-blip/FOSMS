import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

test.describe("Authentication", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects an invalid password", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', DEMO_USERS.supervisor.email);
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in and reaches the dashboard with seeded KPIs", async ({ page }) => {
    await login(page, DEMO_USERS.supervisor);
    await expect(page.getByText(/Welcome back/)).toBeVisible();
    await expect(page.getByText("Today's Arrivals")).toBeVisible();
    await expect(page.getByText("Core Competencies")).toBeVisible();
  });

  test("logs out and can no longer reach protected pages", async ({ page }) => {
    await login(page, DEMO_USERS.supervisor);
    await page.getByRole("button", { name: /Alexandra/ }).click();
    await page.getByText("Sign out").click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
