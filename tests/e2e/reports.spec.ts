import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

test.describe("Reports & Analytics", () => {
  test("shows KPIs, charts, and generates a report via the Report Builder", async ({ page }) => {
    await login(page, DEMO_USERS.superAdmin);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();

    await expect(page.getByText("Total Trainees")).toBeVisible();
    await expect(page.getByText("Competency Completion").last()).toBeVisible();
    await expect(page.getByText("Assessment Results", { exact: true })).toBeVisible();
    await expect(page.getByText("Room Occupancy", { exact: true }).last()).toBeVisible();

    await expect(page.getByText("Report Builder", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Generate Report" }).click();
    await expect(page.locator("#report-preview")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  test("hides export controls for a role without REPORTS_EXPORT", async ({ page }) => {
    await login(page, DEMO_USERS.instructor);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
    await page.getByRole("button", { name: "Generate Report" }).click();
    await expect(page.locator("#report-preview")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  });
});
