import "server-only";
import type { DiscountType, PaymentMethod, Prisma, ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { ReservationConflictError, NotFoundError, AppError } from "@/lib/errors";
import { isRestrictedStatus } from "@/config/room-status";
import { computeFolioCharge, type FolioCharge } from "@/lib/folio-pricing";
import { createInitialReservationCharge } from "@/services/cashiering.service";
import type { CreateReservationInput, UpdateReservationInput } from "@/validators/reservation.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

/**
 * Statuses that hold a room and therefore participate in overlap detection —
 * CANCELLED and NO_SHOW never block a room, and CHECKED_OUT means the stay
 * already ended, so none of those count as "occupying" it. Exported so
 * room.service.ts's date-aware room picker (listRooms) excludes exactly the
 * same reservations this authoritative check would reject, rather than
 * maintaining a second, driftable copy of "which statuses block a room."
 */
export const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

/** "September 1–2, 2026" / "September 30–October 2, 2026" — UTC-based since
 * arrival/departure are date-only (@db.Date) values with no time component;
 * formatting in the server's local timezone could shift the displayed day. */
function formatDateRange(arrivalDate: Date, departureDate: Date): string {
  const utc = { timeZone: "UTC" } as const;
  const year = departureDate.toLocaleDateString("en-US", { year: "numeric", ...utc });
  const sameMonth =
    arrivalDate.getUTCFullYear() === departureDate.getUTCFullYear() &&
    arrivalDate.getUTCMonth() === departureDate.getUTCMonth();

  if (sameMonth) {
    const month = arrivalDate.toLocaleDateString("en-US", { month: "long", ...utc });
    return `${month} ${arrivalDate.getUTCDate()}–${departureDate.getUTCDate()}, ${year}`;
  }

  const from = arrivalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", ...utc });
  const to = departureDate.toLocaleDateString("en-US", { month: "long", day: "numeric", ...utc });
  return `${from}–${to}, ${year}`;
}

export async function nextReservationNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.reservationSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `FO-${year}-${String(seq.lastNumber).padStart(6, "0")}`;
}

export async function assertRoomAvailable(
  tx: Prisma.TransactionClient,
  roomId: string,
  arrivalDate: Date,
  departureDate: Date,
  excludeReservationId?: string
) {
  // Serialize concurrent reservation attempts for the same room so two requests
  // racing on the same dates can't both pass the overlap check below. Also
  // fetches the room number for a human-readable conflict message below.
  const [lockedRoom] = await tx.$queryRaw<{ number: string }[]>`SELECT number FROM rooms WHERE id = ${roomId} FOR UPDATE`;

  // Standard half-open interval overlap: [arrivalDate, departureDate) vs each
  // existing reservation's [existing.arrivalDate, existing.departureDate).
  // Covers identical dates, partial overlap on either edge, and either stay
  // fully containing the other — two ranges overlap iff each one's start is
  // before the other's end.
  const conflict = await tx.reservation.findFirst({
    where: {
      roomId,
      status: { in: ACTIVE_STATUSES },
      arrivalDate: { lt: departureDate },
      departureDate: { gt: arrivalDate },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { id: true, reservationNo: true },
  });

  if (conflict) {
    const roomLabel = lockedRoom ? `Room ${lockedRoom.number}` : "This room";
    throw new ReservationConflictError(
      `${roomLabel} is unavailable for ${formatDateRange(arrivalDate, departureDate)}. ` +
        `Currently reserved under ${conflict.reservationNo}. ` +
        `Please select another available room or change the dates.`
    );
  }
}

export type ReservationListFilters = {
  status?: ReservationStatus | ReservationStatus[];
  roomId?: string;
  id?: string;
};

const listInclude = {
  guest: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true } },
  room: { select: { id: true, number: true, roomType: { select: { name: true } } } },
} satisfies Prisma.ReservationInclude;

export async function listReservations(pagination: PaginationInput, filters: ReservationListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.ReservationWhereInput = {
    ...(filters.status
      ? { status: Array.isArray(filters.status) ? { in: filters.status } : filters.status }
      : {}),
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    ...(filters.id ? { id: filters.id } : {}),
    ...(search
      ? {
          OR: [
            { reservationNo: { contains: search, mode: "insensitive" } },
            { guest: { firstName: { contains: search, mode: "insensitive" } } },
            { guest: { middleName: { contains: search, mode: "insensitive" } } },
            { guest: { lastName: { contains: search, mode: "insensitive" } } },
            { room: { number: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const sortableFields = new Set(["createdAt", "arrivalDate", "departureDate", "reservationNo", "status"]);
  const orderBy: Prisma.ReservationOrderByWithRelationInput = sortBy && sortableFields.has(sortBy)
    ? { [sortBy]: sortDir }
    : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: listInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { rows, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getReservationById(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { ...listInclude, createdBy: { select: { firstName: true, lastName: true } }, checkIn: true, checkOut: true },
  });
  if (!reservation) throw new NotFoundError("Reservation not found.");
  return reservation;
}

type ActorContext = {
  userId: string;
  role: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Validates the room and computes its reservation's initial Cashiering
 * charge BEFORE any row is written — shared by createReservation() and the
 * Guest Folio's atomic createGuestFolioWithReservationAndCharge()
 * (guest.service.ts), so both entry points price and validate a room the
 * exact same way instead of two implementations that could drift apart.
 * Throwing here (room missing/restricted/mispriced) never leaves a
 * partially-created guest or reservation behind, since nothing has been
 * written yet.
 */
export async function resolveInitialReservationCharge(
  roomId: string,
  pricing: {
    bedCount?: number;
    discountType?: DiscountType | null;
    otherDiscountType?: string | null;
    otherDiscountRate?: number | null;
  }
) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Room not found.");
  if (isRestrictedStatus(room.status)) {
    throw new AppError("This room is not available for reservations.", "ROOM_UNAVAILABLE", 409);
  }

  const charge = await computeFolioCharge({
    roomTypeId: room.roomTypeId,
    bedCount: pricing.bedCount,
    discountType: pricing.discountType ?? null,
    otherDiscountType: pricing.otherDiscountType,
    otherDiscountRate: pricing.otherDiscountRate,
  });

  return { room, charge };
}

/**
 * Creates the Reservation and its initial Cashiering CHARGE together, inside
 * an already-open transaction — the reusable core both createReservation()
 * (standalone Reservations module) and the Guest Folio's atomic
 * createGuestFolioWithReservationAndCharge() (guest.service.ts) call, so a
 * Reservation can never be created without the charge that makes it
 * reachable by Cashiering's Guests Awaiting Payment query.
 */
export async function createReservationAndChargeInTx(
  tx: Prisma.TransactionClient,
  input: CreateReservationInput,
  room: { id: string; roomTypeId: string },
  charge: FolioCharge,
  actor: ActorContext,
  // Guest Folio's Mode of Payment, recorded upfront on the initial CHARGE —
  // the standalone Reservations module has no such field and never passes this.
  billing?: { paymentMethod?: PaymentMethod | null; otherPaymentMethod?: string | null },
  // Distinguishes the Walk-In Guest form (checked in immediately, no prior
  // reservation) from the standalone Reservations module and the Guest
  // Folio's room-assignment section (both "normal reservation" — PENDING,
  // guestType RESERVATION). Independent of `source` above, which is just the
  // booking channel a staff member can pick.
  overrides?: { guestType?: "RESERVATION" | "WALK_IN"; status?: ReservationStatus }
) {
  const arrivalDate = new Date(input.arrivalDate);
  const departureDate = new Date(input.departureDate);

  await assertRoomAvailable(tx, input.roomId, arrivalDate, departureDate);

  const reservationNo = await nextReservationNumber(tx);
  const reservation = await tx.reservation.create({
    data: {
      reservationNo,
      guestId: input.guestId,
      roomId: input.roomId,
      arrivalDate,
      departureDate,
      numGuests: input.numGuests,
      source: input.source,
      guestType: overrides?.guestType ?? "RESERVATION",
      ...(overrides?.status ? { status: overrides.status } : {}),
      specialRequests: input.specialRequests || null,
      notes: input.notes || null,
      createdById: actor.userId,
    },
    include: listInclude,
  });

  const transaction = await createInitialReservationCharge(tx, {
    reservationId: reservation.id,
    userId: actor.userId,
    roomTypeId: room.roomTypeId,
    charge,
    paymentMethod: billing?.paymentMethod ?? null,
    otherPaymentMethod: billing?.otherPaymentMethod ?? null,
  });

  return { reservation, transaction };
}

export async function createReservation(input: CreateReservationInput, actor: ActorContext) {
  const { room, charge } = await resolveInitialReservationCharge(input.roomId, {
    bedCount: input.bedCount,
    discountType: input.discountType,
    otherDiscountType: input.otherDiscountType,
    otherDiscountRate: input.otherDiscountRate ? Number(input.otherDiscountRate) : null,
  });

  const { reservation, transaction } = await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUnique({ where: { id: input.guestId, deletedAt: null } });
    if (!guest) throw new NotFoundError("Guest not found.");

    return createReservationAndChargeInTx(tx, input, room, charge, actor);
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "reservations",
    recordId: reservation.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { reservationNo: reservation.reservationNo, roomId: reservation.roomId, status: reservation.status },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PAYMENT_RECEIVED",
    module: "cashiering",
    recordId: transaction.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { transactionNo: transaction.transactionNo, type: transaction.type, amount: transaction.amount },
  });

  return reservation;
}

export async function updateReservation(id: string, input: UpdateReservationInput, actor: ActorContext) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Reservation not found.");
    if (existing.status === "CANCELLED" || existing.status === "CHECKED_OUT") {
      throw new AppError(
        `Cannot edit a reservation that is already ${existing.status.toLowerCase().replace("_", " ")}.`,
        "RESERVATION_LOCKED",
        409
      );
    }

    const roomId = input.roomId ?? existing.roomId;
    const arrivalDate = input.arrivalDate ? new Date(input.arrivalDate) : existing.arrivalDate;
    const departureDate = input.departureDate ? new Date(input.departureDate) : existing.departureDate;

    if (input.roomId || input.arrivalDate || input.departureDate) {
      await assertRoomAvailable(tx, roomId, arrivalDate, departureDate, id);
    }

    return tx.reservation.update({
      where: { id },
      data: {
        roomId,
        arrivalDate,
        departureDate,
        numGuests: input.numGuests ?? undefined,
        source: input.source ?? undefined,
        specialRequests: input.specialRequests ?? undefined,
        notes: input.notes ?? undefined,
      },
      include: listInclude,
    });
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "reservations",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: input,
  });

  return updated;
}

export async function setReservationStatus(id: string, status: ReservationStatus, actor: ActorContext) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Reservation not found.");

  if (existing.status === "CANCELLED" || existing.status === "CHECKED_OUT") {
    throw new AppError(
      `Cannot change status of a reservation that is already ${existing.status.toLowerCase().replace("_", " ")}.`,
      "RESERVATION_LOCKED",
      409
    );
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : undefined,
    },
    include: listInclude,
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: status === "CANCELLED" ? "CANCEL" : "UPDATE",
    module: "reservations",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  return updated;
}
