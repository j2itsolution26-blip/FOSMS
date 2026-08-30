import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { roomSchema, roomStatusEnum } from "@/validators/room.schema";
import { createRoom, listRooms, getRoomOccupancySummary } from "@/services/room.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ROOMS_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const statusParam = searchParams.get("status");
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => roomStatusEnum.safeParse(s.trim()))
        .filter((r) => r.success)
        .map((r) => r.data)
    : [];

  const includeSummary = searchParams.get("includeSummary") === "true";
  const isSmokingParam = searchParams.get("isSmoking");

  const rooms = await listRooms({
    status: statuses.length === 0 ? undefined : statuses.length === 1 ? statuses[0] : statuses,
    search: searchParams.get("search") ?? undefined,
    roomTypeId: searchParams.get("roomTypeId") ?? undefined,
    isSmoking: isSmokingParam === null ? undefined : isSmokingParam === "true",
    id: searchParams.get("roomId") ?? undefined,
  });

  if (includeSummary) {
    const { listRoomTypes } = await import("@/services/room.service");
    const [roomTypes, statusSummary] = await Promise.all([listRoomTypes(), getRoomOccupancySummary()]);
    return apiSuccess({ rooms, roomTypes, statusSummary });
  }

  return apiSuccess(rooms);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ROOMS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = roomSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const room = await createRoom(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(room, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "rooms/create");
  }
}
