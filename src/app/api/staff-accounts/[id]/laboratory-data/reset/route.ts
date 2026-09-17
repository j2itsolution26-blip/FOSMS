import type { NextRequest } from "next/server";

import { apiError, apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { resetLaboratoryDataSchema } from "@/validators/lab-reset.schema";
import { resetStaffAccountLabData } from "@/services/staff-account.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Clears ONE Front Desk account's laboratory data. Same gate as the
 * Supervisor-wide reset (LAB_DATA_RESET) plus account management, and the
 * typed "RESET" is re-checked here — never trusted from the UI alone.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user, PERMISSIONS.LAB_DATA_RESET)) return apiForbidden();

  const json = await req.json().catch(() => null);
  const parsed = resetLaboratoryDataSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { id } = await params;
  try {
    const result = await resetStaffAccountLabData(id, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof AppError) return handleServiceError(err, "staff-accounts/laboratory-data/reset");
    // The transaction rolled back — nothing was partially deleted.
    console.error("[staff-accounts/laboratory-data/reset]", err);
    return apiError(
      "Reset failed — no changes were made. Every record was rolled back; see the server log for the full error.",
      "LAB_RESET_FAILED",
      500
    );
  }
}
