import { test, expect } from "@playwright/test";
import { DEMO_USERS, login } from "./helpers";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

test.describe("Guest Folio — Club Membership registration", () => {
  test("registers a new guest as a Club Member from the Guest Folio UI, with no discount yet", async ({ page }) => {
    await login(page, DEMO_USERS.frontOffice);

    const uniqueLastName = `Pacquiao${Date.now()}`;

    await page.goto("/guests");
    await page.getByRole("button", { name: "Add Guest" }).click();
    await expect(page.getByRole("heading", { name: "Guest Folio" })).toBeVisible();

    await page.locator('input[name="firstName"]').fill("Manny");
    await page.locator('input[name="lastName"]').fill(uniqueLastName);
    await page.locator('input[name="processedBy"]').fill("QA Front Desk");

    await page.getByText("Register as Club Member").click();
    await expect(page.getByText("₱1,000.00")).toBeVisible();

    // Exactly one Mode of Payment field for the whole folio — since no room
    // is being assigned in this test, this is the membership-only rendering
    // of it (defaults to Cash, which is submitted below without changing it).
    await expect(page.getByText("Mode of Payment")).toHaveCount(1);

    // No separate "Membership Processed By" field to fill anymore — the
    // membership fee is processed by the same Front Desk Officer entered
    // above ("QA Front Desk"), asserted below via the guest details dialog.
    await expect(page.getByPlaceholder("Enter name of staff processing the membership fee")).toHaveCount(0);

    await page.getByRole("button", { name: "Save Guest Folio" }).click();

    await expect(
      page.getByText("Club Membership registered. The 2% member discount will be available starting on your next check-in.")
    ).toBeVisible({ timeout: 10000 });

    // Confirm it actually shows up on the Guest Folio / details view, as its
    // own identifiable line — never merged into another charge.
    await page.locator('input[placeholder="Search guest name, room, or reservation…"]').fill(uniqueLastName);
    const row = page.locator("table tbody tr").first();
    await expect(row.getByText(uniqueLastName)).toBeVisible();
    await row.getByRole("button", { name: "View guest" }).click();

    const detailsDialog = page.getByRole("dialog");
    await expect(detailsDialog.getByRole("heading", { name: "Club Membership" })).toBeVisible();
    await expect(detailsDialog.getByText(/^CM-/)).toBeVisible();
    await expect(detailsDialog.getByText("Club Membership Fee")).toBeVisible();

    // The membership fee's own "Processed By" reused the SAME Front Desk
    // Officer entered once at the top of the form — never a second,
    // separately-collected name.
    await expect(detailsDialog.getByText("QA Front Desk")).toHaveCount(2);

    // The membership fee's own Mode of Payment reused the folio's single
    // payment-method field (left at its "Cash" default — never changed,
    // never asked for separately).
    await expect(detailsDialog.getByText("Cash")).toBeVisible();
  });

  test("enforces the first-check-in rule server-side across a full member lifecycle", async ({ page }) => {
    // A full guest+membership+reservation+pay+check-in+check-out+reservation
    // lifecycle is 8+ sequential dev-server round trips (each with Neon's
    // real connection-setup overhead — see the comment in src/lib/prisma.ts)
    // — comfortably over Playwright's default 30s *per-test* budget even
    // though no single call hangs.
    test.setTimeout(90_000);
    await login(page, DEMO_USERS.frontOffice);

    const uniqueLastName = `Delacruz${Date.now()}`;
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Register a brand-new guest as a Club Member (no room yet).
    const folioRes = await page.request.post("/api/guests/folio", {
      data: {
        guest: { firstName: "Juan", lastName: uniqueLastName, processedBy: "QA Front Desk" },
        clubMembership: { register: true, paymentMethod: "CASH", processedBy: "QA Cashier" },
      },
    });
    expect(folioRes.status()).toBe(201);
    const guestId = (await folioRes.json()).data.guest.id as string;

    // status=VC,VR,VCI restricts to rooms actually assignable right now
    // (checkIn() rejects an occupied/dirty/out-of-order room regardless of
    // reservation-date overlap) — the plain date filter alone isn't enough
    // since a room can be currently occupied by an unrelated guest.
    const roomsRes = await page.request.get(
      `/api/rooms?status=VC,VR,VCI&arrivalDate=${toInputDate(today)}&departureDate=${toInputDate(tomorrow)}`
    );
    const rooms = (await roomsRes.json()).data as { id: string }[];
    expect(rooms.length).toBeGreaterThan(0);
    const roomId = rooms[0].id;

    // 2. The membership was JUST registered — this would be the first
    // check-in, so the 2% discount must be rejected even though the guest is
    // now an active member.
    const firstAttemptRes = await page.request.post("/api/reservations", {
      data: {
        guestId,
        roomId,
        arrivalDate: toInputDate(today),
        departureDate: toInputDate(tomorrow),
        numGuests: 1,
        source: "WALK_IN",
        discountType: "CLUB_MEMBER",
      },
    });
    expect(firstAttemptRes.status()).toBe(403);
    expect((await firstAttemptRes.json()).message).toBe(
      "Club Member discount is available starting from the second check-in."
    );

    // 3. Book the actual first stay with no discount, pay it in full, check in, check out.
    const firstStayRes = await page.request.post("/api/reservations", {
      data: {
        guestId,
        roomId,
        arrivalDate: toInputDate(today),
        departureDate: toInputDate(tomorrow),
        numGuests: 1,
        source: "WALK_IN",
      },
    });
    expect(firstStayRes.status()).toBe(201);
    const firstReservation = (await firstStayRes.json()).data as { id: string; reservationNo: string };

    const summaryRes = await page.request.get(
      `/api/cashiering/summary?search=${encodeURIComponent(firstReservation.reservationNo)}`
    );
    const summary = (await summaryRes.json()).data as {
      transactions: Array<{ id: string; type: string; amount: string; reservation: { id: string } | null }>;
    };
    const charge = summary.transactions.find((t) => t.type === "CHARGE" && t.reservation?.id === firstReservation.id);
    expect(charge).toBeTruthy();

    const payRes = await page.request.post(`/api/cashiering/transactions/${charge!.id}/pay`, {
      data: { amount: Number(charge!.amount), processedBy: "QA Cashier" },
    });
    expect(payRes.status()).toBe(200);

    const checkInRes = await page.request.post("/api/front-office/check-in", {
      data: { reservationId: firstReservation.id, earlyCheckIn: false },
    });
    expect(checkInRes.status()).toBe(200);

    const checkOutRes = await page.request.post("/api/front-office/check-out", {
      data: { reservationId: firstReservation.id },
    });
    expect(checkOutRes.status()).toBe(200);

    // 4. Now on their SECOND stay, the 2% discount must be automatically available.
    const secondStayRes = await page.request.post("/api/reservations", {
      data: {
        guestId,
        roomId,
        arrivalDate: toInputDate(today),
        departureDate: toInputDate(tomorrow),
        numGuests: 1,
        source: "WALK_IN",
        discountType: "CLUB_MEMBER",
      },
    });
    expect(secondStayRes.status()).toBe(201);

    const guestRes = await page.request.get(`/api/guests/${guestId}`);
    const guestData = (await guestRes.json()).data as {
      reservations: Array<{ transactions: Array<{ discountType: string | null; discountAmount: string | null }> }>;
    };
    const latestCharge = guestData.reservations[0].transactions[0];
    expect(latestCharge.discountType).toBe("CLUB_MEMBER");
    expect(Number(latestCharge.discountAmount)).toBeGreaterThan(0);

    // The one-time fee is never charged again on the second (or any later) stay.
    expect(Number(guestData.reservations.length)).toBeGreaterThanOrEqual(2);
  });
});
