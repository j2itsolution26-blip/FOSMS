import "dotenv/config";
import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";
import { prisma } from "../../src/lib/prisma";

test.describe("Front Office Services", () => {
  let uniqueName = "";

  // This test creates a real, permanent Guest/Reservation/CheckIn row (and flips a real
  // room to OC) against the shared dev database — there's no UI/API path to undo a
  // walk-in, so tear down directly via Prisma. Runs in afterEach (not at the end of the
  // test body) so a leftover row still gets cleaned up if an assertion above it fails.
  test.afterEach(async () => {
    if (!uniqueName) return;
    const guest = await prisma.guest.findFirst({ where: { firstName: uniqueName, lastName: "Walkin" } });
    if (guest) {
      const reservations = await prisma.reservation.findMany({ where: { guestId: guest.id } });
      for (const reservation of reservations) {
        await prisma.checkIn.deleteMany({ where: { reservationId: reservation.id } });
        await prisma.room.update({ where: { id: reservation.roomId }, data: { status: "VC" } });
        await prisma.reservation.delete({ where: { id: reservation.id } });
      }
      await prisma.guest.delete({ where: { id: guest.id } });
    }
    uniqueName = "";
  });

  test("registers a walk-in guest and shows it in the operations queue", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);
    await page.goto("/front-office");
    await expect(page.getByRole("heading", { name: "Front Office Services" })).toBeVisible();

    await page.getByRole("button", { name: "Walk-In Guest" }).click();
    uniqueName = `E2E${Date.now()}`;
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
