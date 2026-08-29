import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { roomStatusUpdateSchema } from "@/validators/room.schema";
import { updateRoomStatus } from "@/services/room.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ROOMS_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = roomStatusUpdateSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const room = await updateRoomStatus(id, parsed.data.status, parsed.data.note, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      canOverride: hasPermission(auth.user, PERMISSIONS.ROOMS_OVERRIDE),
    });
    return apiSuccess(room);
  } catch (err) {
    return handleServiceError(err, "rooms/status");
  }
}
