import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

test.describe("Reservation workflow", () => {
  test("creates a reservation and confirms it", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);

    await page.goto("/reservations");
    await expect(page.getByRole("heading", { name: "Reservations" })).toBeVisible();

    await page.getByRole("button", { name: "New Reservation" }).click();
    await expect(page.getByRole("heading", { name: "New Reservation" })).toBeVisible();

    await page.getByRole("combobox", { name: "Guest" }).click();
    await page.getByRole("option").first().click();

    await page.getByRole("combobox", { name: "Room" }).click();
    await page.getByRole("option").first().click();

    // A wide, randomized offset avoids colliding with a room booking a previous test run
    // left behind (the room picker only excludes rooms by *current* status, not by date).
    const offsetDays = 100 + Math.floor(Math.random() * 3000);
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + offsetDays);
    const departure = new Date();
    departure.setDate(departure.getDate() + offsetDays + 2);
    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

    await page.locator('input[name="arrivalDate"]').fill(toInputDate(arrival));
    await page.locator('input[name="departureDate"]').fill(toInputDate(departure));

    await page.getByRole("button", { name: "Create Reservation" }).click();

    await expect(page.getByText("Reservation created.")).toBeVisible({ timeout: 10000 });

    // Newest reservation sorts first. Front Office Staff can confirm (but not cancel —
    // that needs RESERVATIONS_CANCEL, which this role doesn't have) so exercise that transition.
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.getByRole("button", { name: "Reservation actions" }).click();
    await page.getByText("Confirm reservation").click();
    await expect(page.getByText("Reservation updated.")).toBeVisible({ timeout: 10000 });
    await expect(firstRow.getByText("Confirmed")).toBeVisible();
  });

  test("rejects an overlapping reservation on the same room (server-side business rule)", async ({ page }) => {
    // The room picker only filters by the room's *current* status (Available/Occupied/…),
    // not by date-range overlap — so this guarantee has to hold at the API/service layer
    // regardless of what the picker shows. Exercise it directly via the API.
    await login(page, DEMO_USERS.frontOffice);

    const roomsRes = await page.request.get("/api/rooms?search=101");
    const roomsBody = await roomsRes.json();
    const room101 = roomsBody.data.find((r: { number: string }) => r.number === "101");
    expect(room101).toBeTruthy();

    const guestsRes = await page.request.get("/api/guests?pageSize=1");
    const guestsBody = await guestsRes.json();
    const guest = guestsBody.data[0];
    expect(guest).toBeTruthy();

    // Room 101 is seeded with a CONFIRMED reservation from today through +3 days.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

    const createRes = await page.request.post("/api/reservations", {
      data: {
        guestId: guest.id,
        roomId: room101.id,
        arrivalDate: toInputDate(tomorrow),
        departureDate: toInputDate(dayAfter),
        numGuests: 1,
        source: "WALK_IN",
      },
    });

    expect(createRes.status()).toBe(409);
    const body = await createRes.json();
    expect(body.code).toBe("RESERVATION_CONFLICT");
  });
});
