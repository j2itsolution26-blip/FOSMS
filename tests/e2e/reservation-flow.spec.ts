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

  test("marks a due reservation as No Show via the confirmation dialog", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);

    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Arrival date is today, on purpose — "Mark as no-show" only appears once
    // arrival is reached. listRooms's date filters return only rooms with no
    // overlapping active reservation for this exact range (room.service.ts).
    const roomsRes = await page.request.get(
      `/api/rooms?arrivalDate=${toInputDate(today)}&departureDate=${toInputDate(tomorrow)}`
    );
    const rooms = (await roomsRes.json()).data as { id: string; number: string }[];
    expect(rooms.length).toBeGreaterThan(0);

    const guestsRes = await page.request.get("/api/guests?pageSize=1");
    const guest = (await guestsRes.json()).data[0];
    expect(guest).toBeTruthy();

    const createRes = await page.request.post("/api/reservations", {
      data: {
        guestId: guest.id,
        roomId: rooms[0].id,
        arrivalDate: toInputDate(today),
        departureDate: toInputDate(tomorrow),
        numGuests: 1,
        source: "WALK_IN",
      },
    });
    expect(createRes.status()).toBe(201);
    const reservationId = (await createRes.json()).data.id as string;

    await page.goto(`/reservations?reservationId=${reservationId}`);
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Reservation actions" }).click();
    await page.getByText("Mark as no-show").click();

    await expect(page.getByText("Mark this reservation as No Show?")).toBeVisible();
    await expect(page.getByText("This will record that the guest did not arrive and was not checked in.")).toBeVisible();

    await page.getByRole("button", { name: "Mark No Show" }).click();

    await expect(page.getByText("Reservation updated.")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("No Show")).toBeVisible();
  });

  test("cancels a reservation via the confirmation dialog and keeps it visible in the list", async ({ page }) => {
    // Front Office Staff now has reservations:cancel (granted alongside this test).
    await login(page, DEMO_USERS.frontOffice);

    const offsetDays = 100 + Math.floor(Math.random() * 3000);
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + offsetDays);
    const departure = new Date();
    departure.setDate(departure.getDate() + offsetDays + 1);
    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

    const roomsRes = await page.request.get(
      `/api/rooms?arrivalDate=${toInputDate(arrival)}&departureDate=${toInputDate(departure)}`
    );
    const rooms = (await roomsRes.json()).data as { id: string; number: string }[];
    expect(rooms.length).toBeGreaterThan(0);

    const guestsRes = await page.request.get("/api/guests?pageSize=1");
    const guest = (await guestsRes.json()).data[0];
    expect(guest).toBeTruthy();

    const createRes = await page.request.post("/api/reservations", {
      data: {
        guestId: guest.id,
        roomId: rooms[0].id,
        arrivalDate: toInputDate(arrival),
        departureDate: toInputDate(departure),
        numGuests: 1,
        source: "WALK_IN",
      },
    });
    expect(createRes.status()).toBe(201);
    const reservation = (await createRes.json()).data as { id: string; reservationNo: string };

    await page.goto(`/reservations?reservationId=${reservation.id}`);
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();

    // Backing out via "Keep Reservation" must not cancel it.
    await row.getByRole("button", { name: "Reservation actions" }).click();
    await page.getByText("Cancel reservation").click();
    await expect(page.getByText("Cancel Reservation?")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(reservation.reservationNo)).toBeVisible();
    await page.getByRole("button", { name: "Keep Reservation" }).click();
    await expect(row.getByText("Pending")).toBeVisible();

    await row.getByRole("button", { name: "Reservation actions" }).click();
    await page.getByText("Cancel reservation").click();
    await page.getByRole("button", { name: "Cancel Reservation" }).click();

    await expect(page.getByText("Reservation updated.")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("Cancelled")).toBeVisible();

    // Cancelled is a closed state: no further status-change actions remain.
    await expect(row.getByRole("button", { name: "Reservation actions" })).toHaveCount(0);
  });

  test("a cancelled reservation cannot be checked in, checked out, confirmed, or marked no-show", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);

    const offsetDays = 100 + Math.floor(Math.random() * 3000);
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + offsetDays);
    const departure = new Date();
    departure.setDate(departure.getDate() + offsetDays + 1);
    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

    const roomsRes = await page.request.get(
      `/api/rooms?arrivalDate=${toInputDate(arrival)}&departureDate=${toInputDate(departure)}`
    );
    const rooms = (await roomsRes.json()).data as { id: string; number: string }[];
    expect(rooms.length).toBeGreaterThan(0);

    const guestsRes = await page.request.get("/api/guests?pageSize=1");
    const guest = (await guestsRes.json()).data[0];

    const createRes = await page.request.post("/api/reservations", {
      data: {
        guestId: guest.id,
        roomId: rooms[0].id,
        arrivalDate: toInputDate(arrival),
        departureDate: toInputDate(departure),
        numGuests: 1,
        source: "WALK_IN",
      },
    });
    const reservation = (await createRes.json()).data as { id: string };

    const cancelRes = await page.request.patch(`/api/reservations/${reservation.id}/status`, {
      data: { status: "CANCELLED" },
    });
    expect(cancelRes.status()).toBe(200);

    for (const status of ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"]) {
      const res = await page.request.patch(`/api/reservations/${reservation.id}/status`, { data: { status } });
      expect(res.status()).toBe(409);
    }

    const checkInRes = await page.request.post("/api/front-office/check-in", {
      data: { reservationId: reservation.id, earlyCheckIn: false },
    });
    expect(checkInRes.status()).toBe(409);
  });
});
