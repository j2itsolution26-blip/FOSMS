import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { resetAccountPasswordSchema } from "@/validators/account.schema";
import { resetAccountPassword } from "@/services/account.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Supervisor-issued password reset for a trainee account. USERS_MANAGE is
 * required here, and resetAccountPassword independently re-verifies that the
 * target is a trainee account and not the caller — so neither the permission
 * check nor the role check is the only thing standing between this endpoint
 * and someone else's credential.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = resetAccountPasswordSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const account = await resetAccountPassword(id, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(account);
  } catch (err) {
    return handleServiceError(err, "account/managed-accounts/password");
  }
}
