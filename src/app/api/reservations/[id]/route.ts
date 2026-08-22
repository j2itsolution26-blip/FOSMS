import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { updateReservationSchema } from "@/validators/reservation.schema";
import { getReservationById, updateReservation } from "@/services/reservation.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.RESERVATIONS_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const reservation = await getReservationById(id);
    return apiSuccess(reservation);
  } catch (err) {
    return handleServiceError(err, "reservations/get");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.RESERVATIONS_UPDATE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = updateReservationSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    const reservation = await updateReservation(id, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });
    return apiSuccess(reservation);
  } catch (err) {
    return handleServiceError(err, "reservations/update");
  }
}
