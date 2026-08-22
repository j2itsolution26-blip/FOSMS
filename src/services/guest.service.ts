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

export async function listGuests(pagination: PaginationInput) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.GuestWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
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
      include: { _count: { select: { reservations: true } } },
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
        include: { room: { select: { number: true } } },
      },
    },
  });
  if (!guest) throw new NotFoundError("Guest not found.");
  return guest;
}

function toGuestData(input: GuestInput) {
  return {
    firstName: input.firstName,
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
    newValue: { firstName: guest.firstName, lastName: guest.lastName },
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
