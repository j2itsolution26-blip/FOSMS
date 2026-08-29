import "server-only";
import type { Prisma, ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { ReservationConflictError, NotFoundError, AppError } from "@/lib/errors";
import type { CreateReservationInput, UpdateReservationInput } from "@/validators/reservation.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

/** Statuses that hold a room and therefore participate in overlap detection. */
const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

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
  // racing on the same dates can't both pass the overlap check below.
  await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;

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
    throw new ReservationConflictError(
      `Room is already reserved for these dates (conflicts with ${conflict.reservationNo}).`
    );
  }
}

export type ReservationListFilters = {
  status?: ReservationStatus | ReservationStatus[];
  roomId?: string;
};

const listInclude = {
  guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  room: { select: { id: true, number: true, roomType: { select: { name: true } } } },
} satisfies Prisma.ReservationInclude;

export async function listReservations(pagination: PaginationInput, filters: ReservationListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.ReservationWhereInput = {
    ...(filters.status
      ? { status: Array.isArray(filters.status) ? { in: filters.status } : filters.status }
      : {}),
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    ...(search
      ? {
          OR: [
            { reservationNo: { contains: search, mode: "insensitive" } },
            { guest: { firstName: { contains: search, mode: "insensitive" } } },
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

export async function createReservation(input: CreateReservationInput, actor: ActorContext) {
  const arrivalDate = new Date(input.arrivalDate);
  const departureDate = new Date(input.departureDate);

  const reservation = await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUnique({ where: { id: input.guestId, deletedAt: null } });
    if (!guest) throw new NotFoundError("Guest not found.");

    const room = await tx.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new NotFoundError("Room not found.");
    if (room.status === "OOO") {
      throw new AppError("This room is not available for reservations.", "ROOM_UNAVAILABLE", 409);
    }

    await assertRoomAvailable(tx, input.roomId, arrivalDate, departureDate);

    const reservationNo = await nextReservationNumber(tx);

    return tx.reservation.create({
      data: {
        reservationNo,
        guestId: input.guestId,
        roomId: input.roomId,
        arrivalDate,
        departureDate,
        numGuests: input.numGuests,
        source: input.source,
        specialRequests: input.specialRequests || null,
        notes: input.notes || null,
        createdById: actor.userId,
      },
      include: listInclude,
    });
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
