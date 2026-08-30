import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { createReservationSchema, reservationStatusEnum } from "@/validators/reservation.schema";
import { createReservation, listReservations } from "@/services/reservation.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.RESERVATIONS_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);
  const statusParam = searchParams.get("status");
  const statusValues = statusParam
    ?.split(",")
    .map((s) => reservationStatusEnum.safeParse(s.trim()))
    .filter((r) => r.success)
    .map((r) => r.data);
  const roomId = searchParams.get("roomId") ?? undefined;
  const reservationId = searchParams.get("reservationId") ?? undefined;

  const { rows, meta } = await listReservations(pagination, {
    status: statusValues && statusValues.length > 0 ? (statusValues.length === 1 ? statusValues[0] : statusValues) : undefined,
    roomId,
    id: reservationId,
  });

  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.RESERVATIONS_CREATE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createReservationSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    const reservation = await createReservation(parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });
    return apiSuccess(reservation, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "reservations/create");
  }
}
