import "server-only";
import type { Prisma, RoomStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, AppError } from "@/lib/errors";
import { findRoomStatusesMatching, isAvailableCategory, isOccupiedCategory } from "@/config/room-status";
import type { RoomInput, RoomTypeInput } from "@/validators/room.schema";

type ActorContext = {
  userId: string;
  role: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function listRoomTypes() {
  return prisma.roomType.findMany({ orderBy: { name: "asc" } });
}

export async function createRoomType(input: RoomTypeInput, actor: ActorContext) {
  const roomType = await prisma.roomType.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description || null,
      baseRate: input.baseRate,
      maxOccupancy: input.maxOccupancy,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "rooms",
    recordId: roomType.id,
    newValue: { code: roomType.code, name: roomType.name },
  });

  return roomType;
}

export async function listRooms(
  filters: { status?: RoomStatus | RoomStatus[]; search?: string; roomTypeId?: string; isSmoking?: boolean } = {}
) {
  const statusMatches = filters.search ? findRoomStatusesMatching(filters.search) : [];

  const where: Prisma.RoomWhereInput = {
    ...(filters.status
      ? { status: Array.isArray(filters.status) ? { in: filters.status } : filters.status }
      : {}),
    ...(filters.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
    ...(filters.isSmoking !== undefined ? { isSmoking: filters.isSmoking } : {}),
    ...(filters.search
      ? {
          OR: [
            { number: { contains: filters.search, mode: "insensitive" } },
            { roomType: { name: { contains: filters.search, mode: "insensitive" } } },
            ...(statusMatches.length ? [{ status: { in: statusMatches } }] : []),
          ],
        }
      : {}),
  };

  return prisma.room.findMany({
    where,
    include: { roomType: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });
}

export async function getRoomOccupancySummary() {
  const grouped = await prisma.room.groupBy({ by: ["status"], _count: { _all: true } });
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<RoomStatus, number>;
  return { total, byStatus };
}

export async function createRoom(input: RoomInput, actor: ActorContext) {
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new NotFoundError("Room type not found.");

  const room = await prisma.room.create({
    data: {
      number: input.number,
      roomTypeId: input.roomTypeId,
      floor: input.floor,
      status: input.status ?? "VC",
    },
    include: { roomType: true },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "rooms",
    recordId: room.id,
    newValue: { number: room.number, status: room.status },
  });

  return room;
}

export async function updateRoomStatus(id: string, status: RoomStatus, note: string | undefined, actor: ActorContext) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Room not found.");

  if (isOccupiedCategory(existing.status) && isAvailableCategory(status)) {
    throw new AppError(
      "An occupied room must be checked out before it can be marked available.",
      "ROOM_OCCUPIED",
      409
    );
  }

  const room = await prisma.$transaction(async (tx) => {
    const updated = await tx.room.update({ where: { id }, data: { status }, include: { roomType: true } });
    await tx.roomStatusHistory.create({ data: { roomId: id, status, note: note || null } });
    return updated;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "rooms",
    recordId: id,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  return room;
}
