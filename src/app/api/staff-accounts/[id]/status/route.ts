import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { staffAccountStatusSchema } from "@/validators/account.schema";
import { setStaffAccountStatus } from "@/services/staff-account.service";

type RouteContext = { params: Promise<{ id: string }> };

/** Activate or deactivate one trainee login (Supervisor only). */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = staffAccountStatusSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { id } = await params;
  try {
    const account = await setStaffAccountStatus(id, parsed.data.status, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(account);
  } catch (err) {
    return handleServiceError(err, "staff-accounts/status");
  }
}
