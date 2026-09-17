import "server-only";
import type { DiscountType, PaymentMethod, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import { computeMembershipFeeCharge } from "@/lib/folio-pricing";
import { formatGuestFullName, guestTypeLabel } from "@/lib/formatters";
import { buildFolioStatement, folioLedgerSelect } from "@/lib/folio-statement";
import { assertRoomAvailable } from "@/services/reservation.service";
import { reservationBalance, listTodayTransactions, getOrCreateCashierSession } from "@/services/cashiering.service";
import { hasActiveMembershipPayment, registerClubMembershipForGuestInTx } from "@/services/club-membership.service";
import { resolveDateRange, type DateRange } from "@/services/report.service";
import { paginationMeta } from "@/validators/pagination.schema";
import { CLUB_MEMBERSHIP_FEE } from "@/validators/club-membership.schema";
import { ASSIGNABLE_ROOM_STATUSES } from "@/config/room-status";
import type {
  CheckInInput,
  CheckOutClubMembershipPaymentInput,
  CheckOutInput,
  GuestVerificationInput,
  RoomTransferInput,
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
  otherPaymentMethod: string | null;
  reversedById: string | null;
  createdAt: string;
  paidAmount: number;
  settledBy: Array<{ id: string; amount: string; reversedById: string | null; createdAt: string }>;
  reservation: {
    id: string;
    reservationNo: string;
    guestId: string;
    roomId: string;
    guestType: "RESERVATION" | "WALK_IN" | null;
    guest: { firstName: string; middleName?: string | null; lastName: string };
    room: { number: string; roomType: { name: string } };
  } | null;
  user: { firstName: string; lastName: string };
  roomType: { name: string } | null;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | "CLUB_MEMBER" | "OTHER" | null;
  otherDiscountType: string | null;
  otherDiscountRate: string | null;
  discountAmount: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  membershipFeeIncluded: string | null;
  processedBy: string | null;
  reference: string | null;
  additionalChargeType: "DAMAGE" | "LOST_ITEM" | "ADDITIONAL_SERVICE" | "OTHER" | "SPECIAL_REQUEST" | null;
  otherChargeType: string | null;
  clubMembership: {
    membershipNo: string;
    guest: { firstName: string; middleName?: string | null; lastName: string };
  } | null;
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
  /** How the reservation this activity traces back to was created — read
   * from the actual Reservation.guestType relationship (see schema comment),
   * never inferred from the activity's own name/type. Null (displayed as
   * "Unknown") for rows created before this field existed, or with no
   * reservation to trace back to at all. */
  guestType: "RESERVATION" | "WALK_IN" | null;
  /** Only present for Charge/Payment/Refund rows — lets the UI reuse the existing
   * Cashiering transaction-details dialog and receipt route without duplicating them. */
  transaction: FrontOfficeActivityTransaction | null;
  /** Only set on Check-in rows — the stay's live status, so actions that
   * operate on the current stay (Special Requests) only appear while the
   * guest is still checked in. */
  reservationStatus?: ReservationStatus;
};

export type FrontOfficeActivityFilters = {
  search?: string;
  activityType?: string;
  staff?: string;
  status?: string;
  /** "RESERVATION" | "WALK_IN" | "UNKNOWN" */
  guestType?: string;
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
    otherPaymentMethod: t.otherPaymentMethod,
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
          guestType: t.reservation.guestType,
          guest: t.reservation.guest,
          room: t.reservation.room,
        }
      : null,
    user: t.user,
    roomType: t.roomType,
    discountType: t.discountType,
    otherDiscountType: t.otherDiscountType,
    otherDiscountRate: t.otherDiscountRate?.toString() ?? null,
    discountAmount: t.discountAmount?.toString() ?? null,
    subtotal: t.subtotal?.toString() ?? null,
    vatAmount: t.vatAmount?.toString() ?? null,
    membershipFeeIncluded: t.membershipFeeIncluded?.toString() ?? null,
    processedBy: t.processedBy,
    reference: t.reference,
    additionalChargeType: t.additionalChargeType,
    otherChargeType: t.otherChargeType,
    clubMembership: t.clubMembership ? { membershipNo: t.clubMembership.membershipNo, guest: t.clubMembership.guest } : null,
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

  // ROOM_TRANSFER/GUEST_VERIFICATION come only from the audit log, which has
  // no Reservation relation — recordId is the reservation id (see
  // transferRoom/verifyGuest), so batch-fetch guestType for just those.
  const transferOrVerifyReservationIds = [
    ...new Set(
      activityLogs
        .filter((t) => (t.action === "ROOM_TRANSFER" || t.action === "GUEST_VERIFICATION") && t.recordId)
        .map((t) => t.recordId as string)
    ),
  ];
  const guestTypeByReservationId = new Map<string, "RESERVATION" | "WALK_IN" | null>();
  if (transferOrVerifyReservationIds.length) {
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: transferOrVerifyReservationIds } },
      select: { id: true, guestType: true },
    });
    for (const r of reservations) guestTypeByReservationId.set(r.id, r.guestType);
  }

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
      guestType: r.guestType,
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
      guestType: r.guestType,
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
      guestType: c.reservation.guestType,
      transaction: null,
      reservationStatus: c.reservation.status,
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
      guestType: c.reservation.guestType,
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
        guestType: t.recordId ? (guestTypeByReservationId.get(t.recordId) ?? null) : null,
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
      guestType: r.guestType,
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
        guestType: t.reservation?.guestType ?? null,
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
    if (filters.guestType && (r.guestType ?? "UNKNOWN") !== filters.guestType) return false;
    if (searchLower) {
      const haystack = [
        r.guestName,
        r.roomNumber,
        r.reservationNo ?? "",
        r.transaction?.transactionNo ?? "",
        r.activity,
        guestTypeLabel(r.guestType),
      ]
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

    // An outstanding balance never blocks check-in — the stay's folio is
    // settled at check-out, where checkOut() below requires a ₱0 balance.

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
      transactions: { select: { type: true, amount: true } },
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
    // Informational only (check-in never requires payment) — the same
    // reservationBalance() ledger math Check-Out and Cashiering use.
    balance: Math.round(reservationBalance(r.transactions) * 100) / 100,
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
        `Checkout cannot be completed because there is an outstanding balance of ₱${balance.toFixed(2)}. Settle it in Cashiering before checking out.`,
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
      transactions: { orderBy: { createdAt: "desc" }, select: folioLedgerSelect },
    },
  });
  if (!reservation) throw new NotFoundError("Reservation not found.");
  if (reservation.status !== "CHECKED_IN") {
    throw new AppError("This guest is not currently checked in.", "INVALID_RESERVATION_STATE", 409);
  }

  // Every line is itemized from the stay's persisted ledger (see
  // buildFolioStatement) — special requests added after check-in, damage
  // charges, and a Check-Out membership fee all show up here automatically.
  const statement = buildFolioStatement(reservation.transactions);
  const charges = reservation.transactions.filter((t) => t.type === "CHARGE");
  const roomCharges = statement.roomCharges;
  // Bed + plain (damage/lost item/manual) charges, as before.
  const additionalCharges = Math.round((statement.bedCharges + statement.otherChargeTotal) * 100) / 100;
  const specialRequests = statement.specialRequestTotal;
  const membership = statement.membershipFee;
  const { discount, vat, total, paid, balance } = statement;

  const existingMembership = await prisma.clubMembership.findUnique({
    where: { guestId: reservation.guestId },
    select: { membershipNo: true, transactions: { where: { type: "PAYMENT" }, select: { reversedById: true } } },
  });
  // Priced (never persisted) with the same helper registerClubMembershipAtCheckOut
  // uses, so the preview the modal adds when the box is ticked is exactly what
  // gets charged.
  const registrationPreview = existingMembership
    ? null
    : await computeMembershipFeeCharge({ membershipFee: CLUB_MEMBERSHIP_FEE, discountType: stayDiscountType(charges) });

  return {
    id: reservation.id,
    reservationNo: reservation.reservationNo,
    guestName: formatGuestFullName(reservation.guest),
    guestType: reservation.guestType,
    room: reservation.room.number,
    roomType: reservation.room.roomType.name,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    folio: { roomCharges, additionalCharges, specialRequests, membership, discount, vat, total, paid, balance },
    specialRequestItems: statement.specialRequests,
    otherChargeItems: statement.otherCharges,
    bedCharges: statement.bedCharges,
    clubMembership: existingMembership
      ? {
          // Any existing record blocks a second registration (guestId is
          // unique) — ACTIVE vs. a record whose fee was refunded is only
          // distinguished for the message the modal shows.
          status: hasActiveMembershipPayment(existingMembership.transactions) ? ("MEMBER" as const) : ("INACTIVE" as const),
          membershipNo: existingMembership.membershipNo,
          registrationPreview: null,
        }
      : { status: "NOT_MEMBER" as const, membershipNo: null, registrationPreview },
  };
}

// The stay's own discount (from its most recent discounted charge) decides
// whether a membership fee billed on it is VAT-exempt — see
// computeMembershipFeeCharge. `charges` must be ordered newest first.
function stayDiscountType(charges: Array<{ discountType: DiscountType | null }>) {
  return charges.find((c) => c.discountType)?.discountType ?? null;
}

/**
 * Check-Out's "Register as Club Member": takes the guest's payment (the same
 * amount/Mode of Payment/Front Desk Officer fields as the modal's existing
 * Process Payment) and registers the membership in ONE database transaction,
 * so a membership can never exist unpaid and the fee is never charged twice.
 *
 * Ledger shape — each peso recorded exactly once:
 *  - a CHARGE on this stay for the ₱1,000 fee + its VAT (membershipFeeIncluded
 *    set, so receipts/Cashiering itemize "Club Membership Registration");
 *  - the membership's own ₱1,000 fee PAYMENT (clubMembershipId set — what
 *    makes it ACTIVE), settling that charge in place;
 *  - a second settling PAYMENT for the fee's VAT, when there is any;
 *  - any amount above the membership total goes toward the stay's remaining
 *    balance as an ordinary payment, same as Process Payment posts it.
 *
 * The 2% Club Member discount is never applied to this stay: eligibility
 * requires a check-in AFTER registration (getClubMemberDiscountEligibility),
 * and this stay's check-in already happened.
 */
export async function registerClubMembershipAtCheckOut(
  reservationId: string,
  input: CheckOutClubMembershipPaymentInput,
  actor: ActorContext
) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId} FOR UPDATE`;
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        transactions: { orderBy: { createdAt: "desc" }, select: { type: true, amount: true, discountType: true } },
      },
    });
    if (!reservation) throw new NotFoundError("Reservation not found.");
    if (reservation.status !== "CHECKED_IN") {
      throw new AppError("Only a checked-in guest can register as a Club Member at check-out.", "INVALID_RESERVATION_STATE", 409);
    }

    const existing = await tx.clubMembership.findUnique({ where: { guestId: reservation.guestId } });
    if (existing) {
      throw new AppError("Already a Club Member.", "MEMBERSHIP_ALREADY_EXISTS", 409);
    }

    const fee = await computeMembershipFeeCharge({
      membershipFee: CLUB_MEMBERSHIP_FEE,
      discountType: stayDiscountType(reservation.transactions.filter((t) => t.type === "CHARGE")),
    });
    const amountDue = Math.round((Math.max(0, reservationBalance(reservation.transactions)) + fee.total) * 100) / 100;
    const amount = Math.round(input.amount * 100) / 100;
    if (amount < fee.total) {
      throw new AppError(
        `The one-time Club Membership fee of ₱${fee.total.toFixed(2)} must be paid in full to register.`,
        "MEMBERSHIP_FEE_UNPAID",
        400
      );
    }
    if (amount > amountDue) {
      throw new AppError(`Payment exceeds the amount due of ₱${amountDue.toFixed(2)}.`, "EXCEEDS_BALANCE", 400);
    }

    const paymentMethod = input.paymentMethod as PaymentMethod;
    const otherPaymentMethod = input.paymentMethod === "OTHER" ? input.otherPaymentMethod || null : null;
    const reference = input.reference || null;

    const sessionId = await getOrCreateCashierSession(tx, actor.userId);
    const charge = await tx.cashierTransaction.create({
      data: {
        transactionNo: await nextNumber(tx, "cashier-transaction", "TXN"),
        sessionId,
        reservationId: reservation.id,
        type: "CHARGE",
        amount: fee.total,
        paymentMethod,
        otherPaymentMethod,
        reference: "Club Membership Registration",
        // Paid in full within this same transaction, so its processor is the
        // officer taking the payment — same as payTransaction() sets it.
        processedBy: input.processedBy,
        userId: actor.userId,
        subtotal: 0,
        discountAmount: 0,
        vatAmount: fee.vatAmount,
        membershipFeeIncluded: fee.membershipFee,
      },
    });

    const { membership, transaction: feePayment } = await registerClubMembershipForGuestInTx(
      tx,
      reservation.guestId,
      {
        paymentMethod,
        otherPaymentMethod,
        processedBy: input.processedBy,
        reference,
        reservationId: reservation.id,
        settlesTransactionId: charge.id,
      },
      actor.userId
    );

    const paymentBase = {
      sessionId,
      reservationId: reservation.id,
      type: "PAYMENT" as const,
      paymentMethod,
      otherPaymentMethod,
      reference,
      processedBy: input.processedBy,
      userId: actor.userId,
    };
    if (fee.vatAmount > 0) {
      await tx.cashierTransaction.create({
        data: {
          ...paymentBase,
          transactionNo: await nextNumber(tx, "cashier-transaction", "TXN"),
          amount: fee.vatAmount,
          settlesTransactionId: charge.id,
        },
      });
    }

    const remainder = Math.round((amount - fee.total) * 100) / 100;
    if (remainder > 0) {
      await tx.cashierTransaction.create({
        data: { ...paymentBase, transactionNo: await nextNumber(tx, "cashier-transaction", "TXN"), amount: remainder },
      });
    }

    return { reservation, membership, charge, feePayment, fee, amount };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CLUB_REGISTRATION",
    module: "front-office",
    recordId: result.membership.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      guestName: formatGuestFullName(result.reservation.guest),
      membershipNo: result.membership.membershipNo,
      reservationNo: result.reservation.reservationNo,
      feeAmount: result.fee.membershipFee,
      vatAmount: result.fee.vatAmount,
    },
  });
  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PAYMENT_RECEIVED",
    module: "cashiering",
    recordId: result.charge.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      transactionNo: result.charge.transactionNo,
      amount: result.amount,
      guestName: formatGuestFullName(result.reservation.guest),
    },
  });

  return { membershipNo: result.membership.membershipNo, chargeId: result.charge.id, amount: result.amount };
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

