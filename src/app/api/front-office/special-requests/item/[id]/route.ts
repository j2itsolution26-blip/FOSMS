import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { deleteSpecialRequest } from "@/services/special-request.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Removes a Special Request (and its still-unpaid charge). Gated by
 * CASHIERING_MANAGE as well, since it can remove a CHARGE from the ledger.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_MANAGE);
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE)) return apiForbidden();

  const { id } = await params;
  try {
    const result = await deleteSpecialRequest(id, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(result);
  } catch (err) {
    return handleServiceError(err, "front-office/special-requests/delete");
  }
}
