import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatGuestFullName } from "@/lib/formatters";
import { assertRoomAvailable, nextReservationNumber } from "@/services/reservation.service";
import { reservationBalance, listTodayTransactions } from "@/services/cashiering.service";
import { resolveDateRange, type DateRange } from "@/services/report.service";
import { paginationMeta } from "@/validators/pagination.schema";
import { ASSIGNABLE_ROOM_STATUSES } from "@/config/room-status";
import type {
  CheckInInput,
  CheckOutInput,
  GuestVerificationInput,
  RoomTransferInput,
  WalkInInput,
} from "@/validators/front-office.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

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

export async function getFrontOfficeKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [todaysCheckIns, todaysCheckOuts, inHouseGuests, awaitingCheckIn, awaitingCheckOut] = await Promise.all([
    prisma.checkIn.count({ where: { checkedInAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.checkOut.count({ where: { checkedOutAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.reservation.count({ where: { status: "CHECKED_IN" } }),
    prisma.reservation.count({
      where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.reservation.count({
      where: { departureDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" },
    }),
  ]);

  return {
    todaysCheckIns,
    todaysCheckOuts,
    inHouseGuests,
    pendingRequests: awaitingCheckIn + awaitingCheckOut,
  };
}

export const FRONT_OFFICE_ACTIVITY_TYPES = [
  "Arrival",
  "Departure",
  "Check-in",
  "Check-out",
  "Room Transfer",
  "Guest Verification",
  "Reservation",
  "Charge",
  "Payment",
  "Refund",
] as const;
export type FrontOfficeActivityType = (typeof FRONT_OFFICE_ACTIVITY_TYPES)[number];

/** The exact shape TransactionDetailsDialog (components/cashiering) expects — mirrored
 * here rather than imported, since this is a server file and that's a client component. */
export type FrontOfficeActivityTransaction = {
  id: string;
  transactionNo: string;
  type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
  amount: string;
  paymentMethod: string | null;
  reversedById: string | null;
  createdAt: string;
  paidAmount: number;
  settledBy: Array<{ id: string; amount: string; reversedById: string | null; createdAt: string }>;
  reservation: {
    id: string;
    reservationNo: string;
    guestId: string;
    roomId: string;
    guest: { firstName: string; middleName?: string | null; lastName: string };
    room: { number: string; roomType: { name: string } };
  } | null;
  user: { firstName: string; lastName: string };
  roomType: { name: string } | null;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | null;
  vatAmount: string | null;
  processedBy: string | null;
};

export type FrontOfficeActivityRow = {
  id: string;
  activity: FrontOfficeActivityType;
  guestName: string;
  guestId: string | null;
  roomNumber: string;
  roomId: string | null;
  reservationId: string | null;
  reservationNo: string | null;
  time: Date;
  staff: string;
  status: "AWAITING_CHECK_IN" | "AWAITING_CHECK_OUT" | "COMPLETED";
  /** Only present for Charge/Payment/Refund rows — lets the UI reuse the existing
   * Cashiering transaction-details dialog and receipt route without duplicating them. */
  transaction: FrontOfficeActivityTransaction | null;
};

export type FrontOfficeActivityFilters = {
  search?: string;
  activityType?: string;
  staff?: string;
  status?: string;
  rangePreset?: string;
  rangeFrom?: string;
  rangeTo?: string;
  page?: number;
  pageSize?: number;
};

function toTransactionShape(t: NonNullable<Awaited<ReturnType<typeof listTodayTransactions>>>[number]): FrontOfficeActivityTransaction {
  return {
    id: t.id,
    transactionNo: t.transactionNo,
    type: t.type,
    amount: t.amount.toString(),
    paymentMethod: t.paymentMethod,
    reversedById: t.reversedById,
    createdAt: t.createdAt.toISOString(),
    paidAmount: t.paidAmount,
    settledBy: t.settledBy.map((s) => ({
      id: s.id,
      amount: s.amount.toString(),
      reversedById: s.reversedById,
      createdAt: s.createdAt.toISOString(),
    })),
    reservation: t.reservation
      ? {
          id: t.reservation.id,
          reservationNo: t.reservation.reservationNo,
          guestId: t.reservation.guestId,
          roomId: t.reservation.roomId,
          guest: t.reservation.guest,
          room: t.reservation.room,
        }
      : null,
    user: t.user,
    roomType: t.roomType,
    discountType: t.discountType,
    vatAmount: t.vatAmount?.toString() ?? null,
    processedBy: t.processedBy,
  };
}

/**
 * Every real front-office activity for the selected date range, merged from
 * their actual source tables (never a single "events" table — this system
 * doesn't have one): reservation arrivals/departures/creation, CheckIn/CheckOut
 * records, ROOM_TRANSFER/GUEST_VERIFICATION audit entries (the only source for
 * those two — no dedicated table), and CashierTransaction rows for
 * Charge/Payment/Refund. Filtered, sorted, and paginated in memory, which is
 * fine at the scale of one property's daily/weekly/monthly activity.
 */
export async function listFrontOfficeActivity(filters: FrontOfficeActivityFilters = {}) {
  const range: DateRange = resolveDateRange(filters.rangePreset ?? "today", filters.rangeFrom, filters.rangeTo);
  const searchLower = (filters.search ?? "").trim().toLowerCase();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 25;

  const [arrivals, departures, checkIns, checkOuts, activityLogs, reservationsCreated, transactions] = await Promise.all([
    prisma.reservation.findMany({
      where: { arrivalDate: { gte: range.from, lte: range.to }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { guest: true, room: true },
    }),
    prisma.reservation.findMany({
      where: { departureDate: { gte: range.from, lte: range.to }, status: "CHECKED_IN" },
      include: { guest: true, room: true },
    }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: range.from, lte: range.to } },
      include: { reservation: { include: { guest: true, room: true } } },
    }),
    prisma.checkOut.findMany({
      where: { checkedOutAt: { gte: range.from, lte: range.to } },
      include: { reservation: { include: { guest: true, room: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        module: "front-office",
        action: { in: ["ROOM_TRANSFER", "GUEST_VERIFICATION", "CHECK_IN", "CHECK_OUT", "WALK_IN"] },
        createdAt: { gte: range.from, lte: range.to },
      },
      include: { user: true },
    }),
    prisma.reservation.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: { guest: true, room: true, createdBy: { select: { firstName: true, lastName: true } } },
    }),
    listTodayTransactions("", range),
  ]);

  // CheckIn/CheckOut records don't carry who performed them; the audit trail does.
  // A walk-in performs its own check-in as part of the same flow, so it counts as one too.
  const staffByReservationAction = new Map<string, string>();
  for (const log of activityLogs) {
    if (!log.recordId || !log.user) continue;
    const staffName = `${log.user.firstName} ${log.user.lastName}`;
    staffByReservationAction.set(`${log.recordId}:${log.action}`, staffName);
    if (log.action === "WALK_IN") {
      staffByReservationAction.set(`${log.recordId}:CHECK_IN`, staffName);
    }
  }

  const rows: FrontOfficeActivityRow[] = [
    ...arrivals.map((r) => ({
      id: `arr-${r.id}`,
      activity: "Arrival" as const,
      guestName: formatGuestFullName(r.guest),
      guestId: r.guestId,
      roomNumber: r.room.number,
      roomId: r.roomId,
      reservationId: r.id,
      reservationNo: r.reservationNo,
      time: r.arrivalDate,
      staff: "—",
      status: "AWAITING_CHECK_IN" as const,
      transaction: null,
    })),
    ...departures.map((r) => ({
      id: `dep-${r.id}`,
      activity: "Departure" as const,
      guestName: formatGuestFullName(r.guest),
      guestId: r.guestId,
      roomNumber: r.room.number,
      roomId: r.roomId,
      reservationId: r.id,
      reservationNo: r.reservationNo,
      time: r.departureDate,
      staff: "—",
      status: "AWAITING_CHECK_OUT" as const,
      transaction: null,
    })),
    ...checkIns.map((c) => ({
      id: `ci-${c.id}`,
      activity: "Check-in" as const,
      guestName: formatGuestFullName(c.reservation.guest),
      guestId: c.reservation.guestId,
      roomNumber: c.reservation.room.number,
      roomId: c.reservation.roomId,
      reservationId: c.reservationId,
      reservationNo: c.reservation.reservationNo,
      time: c.checkedInAt,
      staff: staffByReservationAction.get(`${c.reservationId}:CHECK_IN`) ?? "—",
      status: "COMPLETED" as const,
      transaction: null,
    })),
    ...checkOuts.map((c) => ({
      id: `co-${c.id}`,
      activity: "Check-out" as const,
      guestName: formatGuestFullName(c.reservation.guest),
      guestId: c.reservation.guestId,
      roomNumber: c.reservation.room.number,
      roomId: c.reservation.roomId,
      reservationId: c.reservationId,
      reservationNo: c.reservation.reservationNo,
      time: c.checkedOutAt,
      staff: staffByReservationAction.get(`${c.reservationId}:CHECK_OUT`) ?? "—",
      status: "COMPLETED" as const,
      transaction: null,
    })),
    ...activityLogs
      .filter((t) => t.action === "ROOM_TRANSFER" || t.action === "GUEST_VERIFICATION")
      .map((t) => ({
        id: `tr-${t.id}`,
        activity: (t.action === "ROOM_TRANSFER" ? "Room Transfer" : "Guest Verification") as FrontOfficeActivityType,
        guestName: (t.newValue as { guestName?: string } | null)?.guestName ?? "—",
        guestId: null,
        roomNumber: (t.newValue as { roomNumber?: string } | null)?.roomNumber ?? "—",
        roomId: null,
        reservationId: t.recordId,
        reservationNo: null,
        time: t.createdAt,
        staff: t.user ? `${t.user.firstName} ${t.user.lastName}` : "—",
        status: "COMPLETED" as const,
        transaction: null,
      })),
    ...reservationsCreated.map((r) => ({
      id: `res-${r.id}`,
      activity: "Reservation" as const,
      guestName: formatGuestFullName(r.guest),
      guestId: r.guestId,
      roomNumber: r.room.number,
      roomId: r.roomId,
      reservationId: r.id,
      reservationNo: r.reservationNo,
      time: r.createdAt,
      staff: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : "—",
      status: "COMPLETED" as const,
      transaction: null,
    })),
    ...transactions
      .filter((t) => t.type === "CHARGE" || t.type === "PAYMENT" || t.type === "REFUND")
      .map((t) => ({
        id: `txn-${t.id}`,
        activity: (t.type === "CHARGE" ? "Charge" : t.type === "PAYMENT" ? "Payment" : "Refund") as FrontOfficeActivityType,
        guestName: t.reservation ? formatGuestFullName(t.reservation.guest) : "—",
        guestId: t.reservation?.guestId ?? null,
        roomNumber: t.reservation?.room.number ?? "—",
        roomId: t.reservation?.roomId ?? null,
        reservationId: t.reservation?.id ?? null,
        reservationNo: t.reservation?.reservationNo ?? null,
        time: t.createdAt,
        staff: `${t.user.firstName} ${t.user.lastName}`,
        status: "COMPLETED" as const,
        transaction: toTransactionShape(t),
      })),
  ];

  const filterOptions = {
    activityTypes: [...new Set(rows.map((r) => r.activity))].sort(),
    staff: [...new Set(rows.map((r) => r.staff).filter((s) => s !== "—"))].sort(),
  };

  const filtered = rows.filter((r) => {
    if (filters.activityType && r.activity !== filters.activityType) return false;
    if (filters.staff && r.staff !== filters.staff) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (searchLower) {
      const haystack = [r.guestName, r.roomNumber, r.reservationNo ?? "", r.transaction?.transactionNo ?? "", r.activity]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });

  const sorted = filtered.sort((a, b) => b.time.getTime() - a.time.getTime());
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  return { rows: pageRows, meta: paginationMeta(total, { page, pageSize }), filterOptions };
}

export async function checkIn(input: CheckInInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    // Row-locked so two front-desk users racing the same reservation/room can't both check it in.
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${input.reservationId} FOR UPDATE`;
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) throw new NotFoundError("Reservation not found.");
    if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
      throw new AppError(
        `Cannot check in a reservation that is ${reservation.status.toLowerCase().replace("_", " ")}.`,
        "INVALID_RESERVATION_STATE",
        409
      );
    }

    // The room may have changed state since the reservation was made (taken by a
    // walk-in, flagged out of order, blocked, etc.) — re-verify it's still
    // assignable right before occupying it, not just trust the booking.
    await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${reservation.roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: reservation.roomId } });
    if (!room) throw new NotFoundError("Room not found.");
    if (!ASSIGNABLE_ROOM_STATUSES.includes(room.status)) {
      throw new AppError(
        `Room ${room.number} is no longer available (status: ${room.status}). Reassign the guest to a different room before checking in.`,
        "ROOM_UNAVAILABLE",
        409
      );
    }

    await tx.checkIn.create({
      data: {
        reservationId: reservation.id,
        keyCardStatus: input.keyCardStatus || null,
        earlyCheckIn: input.earlyCheckIn,
        notes: input.notes || null,
      },
    });
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CHECKED_IN" } });
    await tx.room.update({ where: { id: reservation.roomId }, data: { status: "OC" } });
    await tx.roomStatusHistory.create({
      data: { roomId: reservation.roomId, status: "OC", note: "Guest checked in", changedById: actor.userId },
    });

    return reservation;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CHECK_IN",
    module: "front-office",
    recordId: result.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { reservationNo: result.reservationNo, guestName: formatGuestFullName(result.guest), roomNumber: result.room.number },
  });

  return result;
}

/**
 * The Check-In modal's guest selector. Eligible = not yet checked in, not
 * cancelled/checked out, AND due to arrive today or earlier — a reservation
 * years in the future has no business showing up as a check-in candidate.
 * This arrival-date window is what actually keeps stray future-dated test
 * bookings out of the list; it isn't a cosmetic frontend filter.
 */
export async function listCheckInEligibleReservations() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, arrivalDate: { lte: endOfDay(new Date()) } },
    orderBy: { arrivalDate: "desc" },
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
    },
  });

  return reservations.map((r) => ({
    id: r.id,
    reservationNo: r.reservationNo,
    guestName: formatGuestFullName(r.guest),
    room: r.room.number,
    roomType: r.room.roomType.name,
    arrivalDate: r.arrivalDate,
    departureDate: r.departureDate,
    status: r.status,
  }));
}

export async function checkOut(input: CheckOutInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) throw new NotFoundError("Reservation not found.");
    if (reservation.status !== "CHECKED_IN") {
      throw new AppError("Only a checked-in reservation can be checked out.", "INVALID_RESERVATION_STATE", 409);
    }

    // A checked-out guest cannot receive normal charges afterward, so outstanding
    // balances must be settled (or explicitly reversed) before check-out proceeds.
    const transactions = await tx.cashierTransaction.findMany({ where: { reservationId: reservation.id } });
    const balance = reservationBalance(transactions);
    if (balance > 0) {
      throw new AppError(
        `This guest has an outstanding balance of ₱${balance.toFixed(2)}. Settle it in Cashiering before checking out.`,
        "OUTSTANDING_BALANCE",
        409
      );
    }

    await tx.checkOut.create({
      data: { reservationId: reservation.id, lateCheckOut: input.lateCheckOut, notes: input.notes || null },
    });
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CHECKED_OUT" } });
    await tx.room.update({ where: { id: reservation.roomId }, data: { status: "VD" } });
    await tx.roomStatusHistory.create({
      data: { roomId: reservation.roomId, status: "VD", note: "Guest checked out", changedById: actor.userId },
    });

    return reservation;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CHECK_OUT",
    module: "front-office",
    recordId: result.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { reservationNo: result.reservationNo, guestName: formatGuestFullName(result.guest), roomNumber: result.room.number },
  });

  return result;
}

/**
 * The Check-Out modal's guest selector: real, currently-in-house reservations
 * only (status CHECKED_IN) — never future/cancelled/completed reservations or
 * demo data. Guest name is always the actual formatted First/Middle/Last
 * name, never a reservation/folio ID.
 */
export async function listInHouseReservations() {
  const reservations = await prisma.reservation.findMany({
    where: { status: "CHECKED_IN" },
    orderBy: { departureDate: "asc" },
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
    },
  });

  return reservations.map((r) => ({
    id: r.id,
    reservationNo: r.reservationNo,
    guestName: formatGuestFullName(r.guest),
    room: r.room.number,
    roomType: r.room.roomType.name,
    arrivalDate: r.arrivalDate,
    departureDate: r.departureDate,
  }));
}

/**
 * The Check-Out review step's folio summary for one in-house reservation.
 * `balance` is computed with the exact same reservationBalance() math the
 * checkOut() gate above enforces server-side, so the modal's "ready to
 * check out" state can never disagree with what the API will actually allow.
 */
export async function getCheckoutFolioSummary(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
      transactions: {
        select: { type: true, amount: true, subtotal: true, bedCharge: true, discountAmount: true, vatAmount: true },
      },
    },
  });
  if (!reservation) throw new NotFoundError("Reservation not found.");
  if (reservation.status !== "CHECKED_IN") {
    throw new AppError("This guest is not currently checked in.", "INVALID_RESERVATION_STATE", 409);
  }

  const charges = reservation.transactions.filter((t) => t.type === "CHARGE");
  const roomCharges = charges.reduce(
    (sum, t) => sum + (t.subtotal != null ? Number(t.subtotal) - Number(t.bedCharge ?? 0) : 0),
    0
  );
  const bedCharges = charges.reduce((sum, t) => sum + (t.subtotal != null ? Number(t.bedCharge ?? 0) : 0), 0);
  const plainCharges = charges.reduce((sum, t) => sum + (t.subtotal == null ? Number(t.amount) : 0), 0);
  const additionalCharges = bedCharges + plainCharges;
  const folioDiscount = charges.reduce((sum, t) => sum + Number(t.discountAmount ?? 0), 0);
  const adHocDiscount = reservation.transactions
    .filter((t) => t.type === "DISCOUNT")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const discount = folioDiscount + adHocDiscount;
  const vat = charges.reduce((sum, t) => sum + Number(t.vatAmount ?? 0), 0);
  const total = roomCharges + additionalCharges - discount + vat;
  const balance = reservationBalance(reservation.transactions);
  const paid = total - balance;

  return {
    id: reservation.id,
    reservationNo: reservation.reservationNo,
    guestName: formatGuestFullName(reservation.guest),
    room: reservation.room.number,
    roomType: reservation.room.roomType.name,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    folio: { roomCharges, additionalCharges, discount, vat, total, paid, balance },
  };
}

export async function transferRoom(input: RoomTransferInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) throw new NotFoundError("Reservation not found.");
    if (reservation.status !== "CHECKED_IN") {
      throw new AppError("Only a checked-in guest can be transferred to a new room.", "INVALID_RESERVATION_STATE", 409);
    }
    if (input.newRoomId === reservation.roomId) {
      throw new AppError("The guest is already in this room.", "SAME_ROOM", 400);
    }

    const newRoom = await tx.room.findUnique({ where: { id: input.newRoomId } });
    if (!newRoom) throw new NotFoundError("Destination room not found.");
    if (!ASSIGNABLE_ROOM_STATUSES.includes(newRoom.status)) {
      throw new AppError("The destination room is not available.", "ROOM_UNAVAILABLE", 409);
    }

    // Same overlap guard (with row lock) reservations use, so a transfer can't land
    // a guest in a room another reservation already holds for these dates.
    await assertRoomAvailable(tx, input.newRoomId, reservation.arrivalDate, reservation.departureDate, reservation.id);

    const oldRoomId = reservation.roomId;
    await tx.reservation.update({ where: { id: reservation.id }, data: { roomId: input.newRoomId } });
    await tx.room.update({ where: { id: input.newRoomId }, data: { status: "OC" } });
    await tx.room.update({ where: { id: oldRoomId }, data: { status: "VD" } });
    await tx.roomStatusHistory.createMany({
      data: [
        {
          roomId: input.newRoomId,
          status: "OC",
          note: `Transferred in from room ${reservation.room.number}`,
          changedById: actor.userId,
        },
        {
          roomId: oldRoomId,
          status: "VD",
          note: `Guest transferred to room ${newRoom.number}`,
          changedById: actor.userId,
        },
      ],
    });

    return { reservation, fromRoomNumber: reservation.room.number, toRoomNumber: newRoom.number };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ROOM_TRANSFER",
    module: "front-office",
    recordId: result.reservation.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { roomNumber: result.fromRoomNumber },
    newValue: {
      guestName: formatGuestFullName(result.reservation.guest),
      roomNumber: result.toRoomNumber,
    },
  });

  return result.reservation;
}

export async function verifyGuest(input: GuestVerificationInput, actor: ActorContext) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { guest: true, room: true },
  });
  if (!reservation) throw new NotFoundError("Reservation not found.");

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "GUEST_VERIFICATION",
    module: "front-office",
    recordId: reservation.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      guestName: formatGuestFullName(reservation.guest),
      roomNumber: reservation.room.number,
      notes: input.notes || undefined,
    },
  });

  return reservation;
}

export async function walkIn(input: WalkInInput, actor: ActorContext) {
  const arrivalDate = new Date();
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + input.nights);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${input.roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new NotFoundError("Room not found.");
    if (!ASSIGNABLE_ROOM_STATUSES.includes(room.status)) {
      throw new AppError("This room is not available for a walk-in.", "ROOM_UNAVAILABLE", 409);
    }

    const guest = await tx.guest.create({
      data: {
        firstName: input.firstName,
        middleName: input.middleName || null,
        lastName: input.lastName,
        phone: input.phone || null,
        email: input.email || null,
      },
    });

    const reservationNo = await nextReservationNumber(tx);
    const reservation = await tx.reservation.create({
      data: {
        reservationNo,
        guestId: guest.id,
        roomId: input.roomId,
        status: "CHECKED_IN",
        source: "WALK_IN",
        arrivalDate,
        departureDate,
        numGuests: input.numGuests,
        createdById: actor.userId,
      },
    });

    await tx.checkIn.create({ data: { reservationId: reservation.id } });
    await tx.room.update({ where: { id: input.roomId }, data: { status: "OC" } });
    await tx.roomStatusHistory.create({
      data: { roomId: input.roomId, status: "OC", note: "Walk-in guest checked in", changedById: actor.userId },
    });

    return { guest, reservation, room };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "WALK_IN",
    module: "front-office",
    recordId: result.reservation.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      reservationNo: result.reservation.reservationNo,
      guestName: formatGuestFullName(result.guest),
      roomNumber: result.room.number,
    },
  });

  return result;
}
