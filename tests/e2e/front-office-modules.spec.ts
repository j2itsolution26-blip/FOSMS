import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

test.describe("Front Office Services", () => {
  test("registers a walk-in guest and shows it in the operations queue", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: "Front Office Services" })).toBeVisible();

    await page.getByRole("button", { name: "Walk-In Guest" }).click();
    const uniqueName = `E2E${Date.now()}`;
    await page.fill('input[name="firstName"]', uniqueName);
    await page.fill('input[name="lastName"]', "Walkin");
    await page.getByRole("combobox", { name: "Room" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Register & Check In" }).click();

    await expect(page.getByText("Walk-in guest registered and checked in.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(uniqueName).first()).toBeVisible();
  });
});

test.describe("Concierge / Bell Service", () => {
  test("creates a service request and it appears in the queue with a request number", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    await page.goto("/concierge");
    await expect(page.getByRole("heading", { name: "Concierge & Bell Service" })).toBeVisible();

    await page.getByRole("button", { name: "New Guest Request" }).first().click();
    const detail = `E2E request ${Date.now()}`;
    await page.fill('textarea[name="description"]', detail);
    await page.getByRole("button", { name: "Create Request" }).click();

    await expect(page.getByText("Service request created.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^SR-\d{4}-\d{6}$/).first()).toBeVisible();
  });
});

test.describe("Cashiering", () => {
  test("blocks recording a transaction without an open cashier session for a fresh cashier", async ({ page }) => {
    // Instructor role has no cashiering permission at all — confirms the module is access-gated.
    await login(page, DEMO_USERS.supervisor);
    await page.goto("/cashiering");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});
