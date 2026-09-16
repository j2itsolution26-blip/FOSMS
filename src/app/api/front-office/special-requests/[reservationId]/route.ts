import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { addSpecialRequestsSchema } from "@/validators/special-request.schema";
import { addSpecialRequests, listSpecialRequests } from "@/services/special-request.service";

type RouteContext = { params: Promise<{ reservationId: string }> };

/** A stay's Special Requests & Additional Charges (Check-In / Check-Out). */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_VIEW);
  if (auth.error) return auth.error;

  const { reservationId } = await params;
  try {
    return apiSuccess(await listSpecialRequests(reservationId));
  } catch (err) {
    return handleServiceError(err, "front-office/special-requests/list");
  }
}

/**
 * Adds Special Requests to a stay. A chargeable one posts a CHARGE, so it
 * also needs the permission every other Cashiering charge requires.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = addSpecialRequestsSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (parsed.data.items.some((i) => i.isChargeable) && !hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE)) {
    return apiForbidden();
  }

  const { reservationId } = await params;
  try {
    const result = await addSpecialRequests(reservationId, parsed.data.items, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "front-office/special-requests/add");
  }
}
