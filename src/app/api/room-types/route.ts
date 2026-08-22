import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { roomTypeSchema } from "@/validators/room.schema";
import { createRoomType, listRoomTypes } from "@/services/room.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.ROOMS_VIEW);
  if (auth.error) return auth.error;

  const roomTypes = await listRoomTypes();
  return apiSuccess(roomTypes);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ROOMS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = roomTypeSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const roomType = await createRoomType(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(roomType, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "room-types/create");
  }
}
