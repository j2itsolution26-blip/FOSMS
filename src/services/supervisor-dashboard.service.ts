import "server-only";
import type { AuditAction } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatGuestFullName } from "@/lib/formatters";
import { getRoomOccupancySummary } from "@/services/room.service";
import { getConciergeKpis, listServiceRequests } from "@/services/concierge.service";
import { ASSIGNABLE_ROOM_STATUSES, ROOM_STATUS_ORDER, isOccupiedCategory } from "@/config/room-status";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Every number here is a direct query or a one-line derivation from existing
 * models — nothing is invented. Two things worth knowing when reading this:
 *
 * - "Staff on duty" has no backing data (no shift/attendance model exists
 *   for non-trainee staff — `Attendance` is trainee-only). `getStaffOnDuty`
 *   below is deliberately built and labeled as "currently signed in"
 *   (an active, unrevoked, unexpired `Session`) rather than "on duty" —
 *   a logged-in session is real data; a shift or physical presence is not,
 *   and this file must not pretend to know the latter.
 * - `NO_SHOW` reservations, and most of the 29 RoomStatus codes (only a
 *   handful are ever written by the automated check-in/check-out/transfer/
 *   walk-in flows — the rest are set manually by housekeeping/front-desk
 *   staff via the Room Management status picker), are real values that may
 *   currently read 0. That's an honest 0 from a real query, not a
 *   fabricated one — the moment a workflow or staff member starts using
 *   those states, these numbers pick it up with no changes needed here.
 */

export async function getSupervisorKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [roomSummary, arrivalsToday, departuresToday, inHouseGuests, openServiceIssues] = await Promise.all([
    getRoomOccupancySummary(),
    prisma.reservation.count({
      where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.reservation.count({
      where: { departureDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" },
    }),
    prisma.reservation.count({ where: { status: "CHECKED_IN" } }),
    prisma.serviceRequest.count({ where: { status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] } } }),
  ]);

  const occupied = ROOM_STATUS_ORDER.filter(isOccupiedCategory).reduce(
    (sum, status) => sum + (roomSummary.byStatus[status] ?? 0),
    0
  );
  const available = ASSIGNABLE_ROOM_STATUSES.reduce((sum, status) => sum + (roomSummary.byStatus[status] ?? 0), 0);
  const occupancyRate = roomSummary.total > 0 ? Math.round((occupied / roomSummary.total) * 100) : 0;

  return {
    occupancyRate,
    arrivalsToday,
    departuresToday,
    inHouseGuests,
    availableRooms: available,
    openServiceIssues,
    roomSummary,
  };
}

export async function getTodaysOperationsSummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    arrivalsToday,
    departuresToday,
    earlyCheckIns,
    lateCheckOuts,
    roomChangesToday,
    pendingReservations,
    noShowsToday,
    walkInsToday,
  ] = await Promise.all([
    prisma.reservation.count({
      where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.reservation.count({
      where: { departureDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" },
    }),
    prisma.checkIn.count({ where: { checkedInAt: { gte: todayStart, lte: todayEnd }, earlyCheckIn: true } }),
    prisma.checkOut.count({ where: { checkedOutAt: { gte: todayStart, lte: todayEnd }, lateCheckOut: true } }),
    prisma.auditLog.count({
      where: { module: "front-office", action: "ROOM_TRANSFER", createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.reservation.count({
      where: { status: "NO_SHOW", arrivalDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.reservation.count({
      where: { source: "WALK_IN", createdAt: { gte: todayStart, lte: todayEnd } },
    }),
  ]);

  return {
    arrivalsToday,
    departuresToday,
    earlyCheckIns,
    lateCheckOuts,
    roomChangesToday,
    pendingReservations,
    noShowsToday,
    walkInsToday,
  };
}

export type SupervisorArrivalRow = {
  id: string;
  reservationNo: string;
  guestName: string;
  roomNumber: string;
  expectedArrival: Date;
  status: string;
};

export async function getTodaysArrivals(): Promise<SupervisorArrivalRow[]> {
  const now = new Date();
  const rows = await prisma.reservation.findMany({
    where: { arrivalDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { in: ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"] } },
    include: { guest: { select: { firstName: true, middleName: true, lastName: true } }, room: { select: { number: true } } },
    orderBy: { arrivalDate: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    reservationNo: r.reservationNo,
    guestName: formatGuestFullName(r.guest),
    roomNumber: r.room.number,
    expectedArrival: r.arrivalDate,
    status: r.status,
  }));
}

export type SupervisorDepartureRow = {
  id: string;
  reservationNo: string;
  guestName: string;
  roomNumber: string;
  departureTime: Date;
  balance: number;
  status: string;
};

export async function getTodaysDepartures(): Promise<SupervisorDepartureRow[]> {
  const now = new Date();
  const rows = await prisma.reservation.findMany({
    where: { departureDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } },
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true } },
      transactions: { select: { type: true, amount: true } },
    },
    orderBy: { departureDate: "asc" },
  });

  return rows.map((r) => {
    // Same balance derivation used by front-office.service.ts's checkOut() guard —
    // there is no dedicated "folio" model, this is the real running balance.
    const balance = r.transactions.reduce((sum, t) => {
      const amount = Number(t.amount);
      if (t.type === "CHARGE") return sum + amount;
      if (t.type === "PAYMENT" || t.type === "DISCOUNT" || t.type === "REFUND") return sum - amount;
      return sum;
    }, 0);

    return {
      id: r.id,
      reservationNo: r.reservationNo,
      guestName: formatGuestFullName(r.guest),
      roomNumber: r.room.number,
      departureTime: r.departureDate,
      balance,
      status: r.status,
    };
  });
}

export async function getReservationOverview() {
  const grouped = await prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } });
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const walkInToday = await prisma.reservation.count({
    where: { source: "WALK_IN", createdAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
  });
  return { byStatus, walkInToday };
}

/** Real login sessions, not a shift/attendance system — see the file header comment. */
export async function getStaffOnDuty() {
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { revokedAt: null, expiresAt: { gt: now } },
    include: { user: { include: { roles: { include: { role: true } } } } },
    orderBy: { expiresAt: "desc" },
  });

  const seen = new Map<string, { id: string; name: string; role: string; email: string; signedInSince: Date }>();
  for (const s of sessions) {
    if (seen.has(s.userId) || !s.user || s.user.deletedAt || !s.user.isActive) continue;
    seen.set(s.userId, {
      id: s.user.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      role: s.user.roles[0]?.role.label ?? "—",
      email: s.user.email,
      signedInSince: s.createdAt,
    });
  }
  return Array.from(seen.values());
}

export async function getGuestIssues() {
  const [kpis, requests] = await Promise.all([getConciergeKpis(), listServiceRequests()]);
  return { kpis, requests: requests.slice(0, 8) };
}

const FRONT_OFFICE_ACTIVITY_ACTIONS: AuditAction[] = [
  "CHECK_IN",
  "CHECK_OUT",
  "ROOM_TRANSFER",
  "GUEST_VERIFICATION",
  "WALK_IN",
  "CREATE",
  "UPDATE",
  "CANCEL",
  "SERVICE_REQUEST_CREATED",
  "SERVICE_REQUEST_ASSIGNED",
  "SERVICE_REQUEST_COMPLETED",
];
const FRONT_OFFICE_ACTIVITY_MODULES = ["front-office", "reservations", "rooms", "concierge", "club-reception"];

export async function getRecentFrontOfficeActivity(limit = 10) {
  return prisma.auditLog.findMany({
    where: {
      module: { in: FRONT_OFFICE_ACTIVITY_MODULES },
      action: { in: FRONT_OFFICE_ACTIVITY_ACTIONS },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}
