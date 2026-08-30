import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatGuestFullName } from "@/lib/formatters";
import { assertRoomAvailable, nextReservationNumber } from "@/services/reservation.service";
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

export type FrontOfficeOperation = {
  id: string;
  guestName: string;
  roomNumber: string;
  transaction: "Arrival" | "Departure" | "Check-in" | "Check-out" | "Room Transfer" | "Guest Verification";
  time: Date;
  staff: string;
  status: "AWAITING_CHECK_IN" | "AWAITING_CHECK_OUT" | "COMPLETED";
  reservationId: string;
};

export async function listTodayOperations(search = ""): Promise<FrontOfficeOperation[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const searchLower = search.trim().toLowerCase();

  const [arrivals, departures, checkIns, checkOuts, activityLogs] = await Promise.all([
    prisma.reservation.findMany({
      where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { guest: true, room: true },
    }),
    prisma.reservation.findMany({
      where: { departureDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" },
      include: { guest: true, room: true },
    }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: todayStart, lte: todayEnd } },
      include: { reservation: { include: { guest: true, room: true } } },
    }),
    prisma.checkOut.findMany({
      where: { checkedOutAt: { gte: todayStart, lte: todayEnd } },
      include: { reservation: { include: { guest: true, room: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        module: "front-office",
        action: { in: ["ROOM_TRANSFER", "GUEST_VERIFICATION", "CHECK_IN", "CHECK_OUT", "WALK_IN"] },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: { user: true },
    }),
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

  const rows: FrontOfficeOperation[] = [
    ...arrivals.map((r) => ({
      id: `arr-${r.id}`,
      guestName: formatGuestFullName(r.guest),
      roomNumber: r.room.number,
      transaction: "Arrival" as const,
      time: r.arrivalDate,
      staff: "—",
      status: "AWAITING_CHECK_IN" as const,
      reservationId: r.id,
    })),
    ...departures.map((r) => ({
      id: `dep-${r.id}`,
      guestName: formatGuestFullName(r.guest),
      roomNumber: r.room.number,
      transaction: "Departure" as const,
      time: r.departureDate,
      staff: "—",
      status: "AWAITING_CHECK_OUT" as const,
      reservationId: r.id,
    })),
    ...checkIns.map((c) => ({
      id: `ci-${c.id}`,
      guestName: formatGuestFullName(c.reservation.guest),
      roomNumber: c.reservation.room.number,
      transaction: "Check-in" as const,
      time: c.checkedInAt,
      staff: staffByReservationAction.get(`${c.reservationId}:CHECK_IN`) ?? "—",
      status: "COMPLETED" as const,
      reservationId: c.reservationId,
    })),
    ...checkOuts.map((c) => ({
      id: `co-${c.id}`,
      guestName: formatGuestFullName(c.reservation.guest),
      roomNumber: c.reservation.room.number,
      transaction: "Check-out" as const,
      time: c.checkedOutAt,
      staff: staffByReservationAction.get(`${c.reservationId}:CHECK_OUT`) ?? "—",
      status: "COMPLETED" as const,
      reservationId: c.reservationId,
    })),
    ...activityLogs
      .filter((t) => t.action === "ROOM_TRANSFER" || t.action === "GUEST_VERIFICATION")
      .map((t) => ({
        id: `tr-${t.id}`,
        guestName: (t.newValue as { guestName?: string } | null)?.guestName ?? "—",
        roomNumber: (t.newValue as { roomNumber?: string } | null)?.roomNumber ?? "—",
        transaction: (t.action === "ROOM_TRANSFER" ? "Room Transfer" : "Guest Verification") as FrontOfficeOperation["transaction"],
        time: t.createdAt,
        staff: t.user ? `${t.user.firstName} ${t.user.lastName}` : "—",
        status: "COMPLETED" as const,
        reservationId: t.recordId ?? "",
      })),
  ];

  const filtered = searchLower
    ? rows.filter(
        (r) =>
          r.guestName.toLowerCase().includes(searchLower) ||
          r.roomNumber.toLowerCase().includes(searchLower)
      )
    : rows;

  return filtered.sort((a, b) => b.time.getTime() - a.time.getTime());
}

export async function checkIn(input: CheckInInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
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
    const balance = transactions.reduce((sum, t) => {
      const amount = Number(t.amount);
      if (t.type === "CHARGE") return sum + amount;
      if (t.type === "PAYMENT" || t.type === "DISCOUNT" || t.type === "REFUND") return sum - amount;
      return sum;
    }, 0);
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
