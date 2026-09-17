import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { deleteSpecialRequest, updateSpecialRequestStatus } from "@/services/special-request.service";

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

const statusSchema = z.object({ status: z.enum(["COMPLETED", "CANCELLED"]) });

/**
 * Marks a PENDING Special Request as COMPLETED or CANCELLED. Cancelling can
 * remove its unpaid CHARGE from the ledger, so it's gated like DELETE.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);
  if (parsed.data.status === "CANCELLED" && !hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE)) {
    return apiForbidden();
  }

  const { id } = await params;
  try {
    const result = await updateSpecialRequestStatus(id, parsed.data.status, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(result);
  } catch (err) {
    return handleServiceError(err, "front-office/special-requests/status");
  }
}
