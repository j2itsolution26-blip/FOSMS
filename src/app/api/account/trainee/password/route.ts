import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { resetAccountPasswordSchema } from "@/validators/account.schema";
import { resetTraineeAccountPassword } from "@/services/account.service";

/**
 * Supervisor-issued password reset for the Trainee / Candidate account.
 *
 * There is deliberately no `[id]` segment: the account is resolved
 * server-side from its role, so this endpoint cannot be aimed at a different
 * user by editing the URL, and adding a second trainee login would not
 * silently become supported here.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = resetAccountPasswordSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const account = await resetTraineeAccountPassword(parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(account);
  } catch (err) {
    return handleServiceError(err, "account/trainee/password");
  }
}
