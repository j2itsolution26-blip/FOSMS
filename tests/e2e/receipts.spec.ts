import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

test.describe("Cashiering — Receipts", () => {
  test("records a payment, finds it in Receipts, opens it, and can print it", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    await page.goto("/cashiering");
    await expect(page.getByRole("heading", { name: "Cashiering" })).toBeVisible();

    // Ensure there's an open cashier session (idempotent across repeated test runs).
    // Checked against the API directly rather than button state, which reflects a
    // brief pre-hydration render before /api/cashiering/summary resolves.
    const summaryRes = await page.request.get("/api/cashiering/summary");
    const summaryBody = await summaryRes.json();
    if (!summaryBody.data.mySessionOpen) {
      await page.getByRole("button", { name: "Open Cashier" }).click();
      await page.fill('input[name="openingCash"]', "1000");
      await page.getByRole("button", { name: "Open Cashier" }).click();
      await expect(page.getByText("Cashier session opened.")).toBeVisible({ timeout: 10000 });
    }

    // Record a real payment through the actual transaction flow (not a DB insert).
    const marker = `E2E-RECEIPT-${Date.now()}`;
    await page.getByRole("button", { name: "Receive Payment" }).click();
    await expect(page.getByRole("heading", { name: "New Transaction" })).toBeVisible();
    await page.getByRole("combobox", { name: "Reservation" }).click();
    await page.getByRole("option").first().click();
    await page.fill('input[name="amount"]', "1234.50");
    await page.fill('input[name="reference"]', marker);
    await page.getByRole("button", { name: "Record Transaction" }).click();
    await expect(page.getByText("Transaction recorded.")).toBeVisible({ timeout: 10000 });

    // The "View Receipts" quick action must navigate to a real Receipts page.
    await page.getByRole("button", { name: "View Receipts" }).click();
    await expect(page).toHaveURL(/\/cashiering\/receipts$/);
    await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible();

    // The payment just recorded must appear, sourced from the database (search by its unique marker).
    await page.getByPlaceholder("Search receipt #, guest, reservation…").fill(marker);
    const row = page.locator("table tbody tr").first();
    await expect(row.getByText("₱1,234.50")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("Paid")).toBeVisible();

    // Open the receipt and confirm the detail page shows the same real data.
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/cashiering\/receipts\/[a-z0-9]+$/);
    await expect(page.getByText("₱1,234.50")).toBeVisible();
    await expect(page.getByText(marker)).toBeVisible();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  });

  test("shows 'No receipts available.' for a search with no matches, never fake rows", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    await page.goto("/cashiering/receipts");
    await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible();

    await page.getByPlaceholder("Search receipt #, guest, reservation…").fill("no-such-receipt-should-ever-exist-zzz");
    await expect(page.getByText("No receipts available.")).toBeVisible({ timeout: 10000 });
  });

  test("blocks a role without CASHIERING_VIEW from the Receipts page", async ({ page }) => {
    await login(page, DEMO_USERS.instructor);
    await page.goto("/cashiering/receipts");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });

  test("returns 404 for a receipt id that does not exist, not a fabricated record", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    const response = await page.goto("/cashiering/receipts/does-not-exist-12345");
    expect(response?.status()).toBe(404);
  });
});
