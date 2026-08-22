import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { roomSchema, roomStatusEnum } from "@/validators/room.schema";
import { createRoom, listRooms } from "@/services/room.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ROOMS_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const statusParam = searchParams.get("status");
  const status = statusParam ? roomStatusEnum.safeParse(statusParam) : undefined;

  const rooms = await listRooms({
    status: status?.success ? status.data : undefined,
    search: searchParams.get("search") ?? undefined,
  });

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
