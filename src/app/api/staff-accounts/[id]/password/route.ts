import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { resetAccountPasswordSchema } from "@/validators/account.schema";
import { resetStaffAccountPassword } from "@/services/staff-account.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Supervisor-issued password for one trainee login. The service only accepts
 * ids of Front Desk A–O accounts, and never changes the account's status.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = resetAccountPasswordSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { id } = await params;
  try {
    const account = await resetStaffAccountPassword(id, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(account);
  } catch (err) {
    return handleServiceError(err, "staff-accounts/password");
  }
}
