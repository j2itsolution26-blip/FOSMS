import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import { createReservationAndChargeInTx, resolveInitialReservationCharge } from "@/services/reservation.service";
import type { GuestInput } from "@/validators/guest.schema";
import type { CreateGuestFolioInput } from "@/validators/guest-folio.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = {
  userId: string;
  role: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type GuestListFilters = {
  /** Matches the Guests page's own display convention — a guest's row shows
   * their most recent reservation, so this filters on "has a reservation of
   * this guest type" rather than requiring every reservation to match. */
  guestType?: "RESERVATION" | "WALK_IN";
  roomTypeId?: string;
};

/**
 * The Guests page shows one row per Guest Folio: the guest plus their most
 * recent Reservation (-> Room -> RoomType) and that reservation's most recent
 * CashierTransaction (-> bed count / discount type / payment method). Mirrors
 * the same relation chain getGuestById below already uses for the guest
 * details dialog — just narrowed to the single latest reservation per guest.
 */
export async function listGuests(pagination: PaginationInput, filters: GuestListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.GuestWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { middleName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            // Guest search also covers the room/reservation shown on their
            // row, so a front desk officer can find a guest by either.
            { reservations: { some: { reservationNo: { contains: search, mode: "insensitive" } } } },
            { reservations: { some: { room: { number: { contains: search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
    ...(filters.guestType || filters.roomTypeId
      ? {
          reservations: {
            some: {
              ...(filters.guestType ? { guestType: filters.guestType } : {}),
              ...(filters.roomTypeId ? { room: { roomTypeId: filters.roomTypeId } } : {}),
            },
          },
        }
      : {}),
  };

  const sortableFields = new Set(["createdAt", "lastName", "firstName"]);
  const orderBy: Prisma.GuestOrderByWithRelationInput =
    sortBy && sortableFields.has(sortBy) ? { [sortBy]: sortDir } : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reservations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            room: { select: { number: true, isSmoking: true, roomType: { select: { name: true } } } },
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                bedCount: true,
                discountType: true,
                otherDiscountType: true,
                otherDiscountRate: true,
                paymentMethod: true,
                otherPaymentMethod: true,
              },
            },
          },
        },
      },
    }),
    prisma.guest.count({ where }),
  ]);

  return { rows, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getGuestById(id: string) {
  const guest = await prisma.guest.findUnique({
    where: { id, deletedAt: null },
    include: {
      reservations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          room: {
            select: { number: true, isSmoking: true, roomType: { select: { name: true } } },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              transactionNo: true,
              type: true,
              amount: true,
              paymentMethod: true,
              otherPaymentMethod: true,
              discountType: true,
              otherDiscountType: true,
              otherDiscountRate: true,
              discountAmount: true,
              subtotal: true,
              vatAmount: true,
              bedCount: true,
              processedBy: true,
              reversedById: true,
              settledBy: { select: { amount: true, reversedById: true } },
            },
          },
        },
      },
    },
  });
  if (!guest) throw new NotFoundError("Guest not found.");
  return guest;
}

function toGuestData(input: GuestInput) {
  return {
    firstName: input.firstName,
    middleName: input.middleName || null,
    lastName: input.lastName,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    identificationType: input.identificationType || null,
    identificationNo: input.identificationNo || null,
    nationality: input.nationality || null,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    preferences: input.preferences || null,
    emergencyContact: input.emergencyContact || null,
    notes: input.notes || null,
    processedBy: input.processedBy,
  };
}

export async function createGuest(input: GuestInput, actor: ActorContext) {
  const guest = await prisma.guest.create({ data: toGuestData(input) });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "guests",
    recordId: guest.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { firstName: guest.firstName, middleName: guest.middleName, lastName: guest.lastName },
  });

  return guest;
}

type GuestFolioRoomInput = NonNullable<CreateGuestFolioInput["room"]>;

/**
 * Atomic Guest Folio save — creates the Guest and, when a room is assigned,
 * its Reservation and initial Cashiering charge, all inside ONE database
 * transaction. Replaces the old flow where the Guest Folio dialog drove
 * Guest -> Reservation -> Charge as three independent client requests: any
 * one of those could fail (or the charge could post at ₱0, if the last step
 * ran ahead of a still-loading price quote) while the earlier ones had
 * already committed, leaving a Reservation with no charge — which made it
 * permanently invisible to Cashiering's Guests Awaiting Payment list even
 * though the Guest Folio itself reported as "saved".
 *
 * Room pricing/availability is resolved (resolveInitialReservationCharge)
 * BEFORE any row is written, so a pricing failure never leaves a bare Guest
 * behind; every write then happens inside one $transaction, so a mid-flow
 * failure (e.g. the room got booked out from under this request) rolls back
 * the Guest along with it instead of leaving a partially-saved folio.
 */
export async function createGuestFolioWithReservationAndCharge(
  guestInput: GuestInput,
  room: GuestFolioRoomInput | null,
  actor: ActorContext
) {
  const resolved = room
    ? await resolveInitialReservationCharge(room.roomId, {
        bedCount: room.bedCount,
        discountType: room.discountType,
        otherDiscountType: room.otherDiscountType,
        otherDiscountRate: room.otherDiscountRate ? Number(room.otherDiscountRate) : null,
      })
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.create({ data: toGuestData(guestInput) });

    if (!room || !resolved) {
      return { guest, reservation: null, transaction: null };
    }

    const { reservation, transaction } = await createReservationAndChargeInTx(
      tx,
      {
        guestId: guest.id,
        roomId: room.roomId,
        arrivalDate: room.arrivalDate,
        departureDate: room.departureDate,
        numGuests: 1,
        source: "WALK_IN",
        specialRequests: "",
        notes: "",
        bedCount: room.bedCount,
        discountType: room.discountType,
      },
      resolved.room,
      resolved.charge,
      actor,
      { paymentMethod: room.paymentMethod, otherPaymentMethod: room.otherPaymentMethod }
    );

    return { guest, reservation, transaction };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "guests",
    recordId: result.guest.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { firstName: result.guest.firstName, middleName: result.guest.middleName, lastName: result.guest.lastName },
  });

  if (result.reservation) {
    await recordAudit({
      userId: actor.userId,
      role: actor.role,
      action: "CREATE",
      module: "reservations",
      recordId: result.reservation.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      newValue: {
        reservationNo: result.reservation.reservationNo,
        roomId: result.reservation.roomId,
        status: result.reservation.status,
      },
    });
  }

  if (result.transaction) {
    await recordAudit({
      userId: actor.userId,
      role: actor.role,
      action: "PAYMENT_RECEIVED",
      module: "cashiering",
      recordId: result.transaction.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      newValue: {
        transactionNo: result.transaction.transactionNo,
        type: result.transaction.type,
        amount: result.transaction.amount,
      },
    });
  }

  return result;
}

/**
 * Walk-In Guest — Step 1 of 2: the exact same guest+room+charge creation as
 * the Guest Folio above (same fields, discount/VAT/payment logic — see
 * createWalkInGuestSchema in guest-folio.schema.ts). Room assignment is
 * mandatory here (a walk-in has nowhere else to go), unlike the Guest
 * Folio's optional toggle.
 *
 * Deliberately does NOT check the guest in and does NOT occupy the room —
 * the reservation is left PENDING with guestType WALK_IN, exactly like a
 * regular reservation with a balance due. Step 2 is the front desk actually
 * collecting payment (payTransaction() in cashiering.service.ts, the same
 * "Transact" flow Cashiering already uses) and then calling the existing
 * checkIn() in front-office.service.ts — which already refuses to check in
 * a reservation with an outstanding balance. Routing the walk-in through
 * that same gate (instead of bypassing it, as this used to) is what
 * enforces "no payment, no check-in" without duplicating that rule anywhere.
 */
export async function createWalkInGuestFolio(guestInput: GuestInput, room: GuestFolioRoomInput, actor: ActorContext) {
  const resolved = await resolveInitialReservationCharge(room.roomId, {
    bedCount: room.bedCount,
    discountType: room.discountType,
    otherDiscountType: room.otherDiscountType,
    otherDiscountRate: room.otherDiscountRate ? Number(room.otherDiscountRate) : null,
  });

  const result = await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.create({ data: toGuestData(guestInput) });

    const { reservation, transaction } = await createReservationAndChargeInTx(
      tx,
      {
        guestId: guest.id,
        roomId: room.roomId,
        arrivalDate: room.arrivalDate,
        departureDate: room.departureDate,
        numGuests: 1,
        source: "WALK_IN",
        specialRequests: "",
        notes: "",
        bedCount: room.bedCount,
        discountType: room.discountType,
      },
      resolved.room,
      resolved.charge,
      actor,
      { paymentMethod: room.paymentMethod, otherPaymentMethod: room.otherPaymentMethod },
      { guestType: "WALK_IN" }
    );

    return { guest, reservation, transaction };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "guests",
    recordId: result.guest.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { firstName: result.guest.firstName, middleName: result.guest.middleName, lastName: result.guest.lastName },
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
      roomId: result.reservation.roomId,
      guestName: `${result.guest.firstName} ${result.guest.lastName}`,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PAYMENT_RECEIVED",
    module: "cashiering",
    recordId: result.transaction.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      transactionNo: result.transaction.transactionNo,
      type: result.transaction.type,
      amount: result.transaction.amount,
    },
  });

  return result;
}

export async function updateGuest(id: string, input: GuestInput, actor: ActorContext) {
  const existing = await prisma.guest.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Guest not found.");

  const guest = await prisma.guest.update({ where: { id }, data: toGuestData(input) });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "guests",
    recordId: guest.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return guest;
}
