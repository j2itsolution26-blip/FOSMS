import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { reservationStatusUpdateSchema } from "@/validators/reservation.schema";
import { setReservationStatus } from "@/services/reservation.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = reservationStatusUpdateSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const requiredPermission =
    parsed.data.status === "CANCELLED" ? PERMISSIONS.RESERVATIONS_CANCEL : PERMISSIONS.RESERVATIONS_UPDATE;
  if (!hasPermission(auth.user, requiredPermission)) return apiForbidden();

  const meta = getRequestMeta(req);

  try {
    const reservation = await setReservationStatus(id, parsed.data.status, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });
    return apiSuccess(reservation);
  } catch (err) {
    return handleServiceError(err, "reservations/status");
  }
}
