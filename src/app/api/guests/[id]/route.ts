import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { guestSchema } from "@/validators/guest.schema";
import { getGuestById, updateGuest } from "@/services/guest.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.GUESTS_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const guest = await getGuestById(id);
    return apiSuccess(guest);
  } catch (err) {
    return handleServiceError(err, "guests/get");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.GUESTS_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = guestSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    const guest = await updateGuest(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...meta });
    return apiSuccess(guest);
  } catch (err) {
    return handleServiceError(err, "guests/update");
  }
}
