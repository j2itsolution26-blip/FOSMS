import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import type { GuestInput } from "@/validators/guest.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = {
  userId: string;
  role: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * The Guests page shows one row per Guest Folio: the guest plus their most
 * recent Reservation (-> Room -> RoomType) and that reservation's most recent
 * CashierTransaction (-> bed count / discount type / payment method). Mirrors
 * the same relation chain getGuestById below already uses for the guest
 * details dialog — just narrowed to the single latest reservation per guest.
 */
export async function listGuests(pagination: PaginationInput) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.GuestWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { middleName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
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
              select: { bedCount: true, discountType: true, paymentMethod: true },
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
            select: { bedCount: true, discountType: true, paymentMethod: true },
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
