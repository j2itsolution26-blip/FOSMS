import "server-only";
import { getCurrentUser, hasPermission, isCurrentAccountDeactivated, type SessionUser } from "@/lib/auth/session";
import { apiError, apiForbidden, apiUnauthorized } from "@/lib/api-response";
import { ACCOUNT_DEACTIVATED_MESSAGE } from "@/lib/auth/constants";
import type { PermissionKey } from "@/config/permissions";
import type { NextResponse } from "next/server";

type AuthorizeResult =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

/**
 * Route-handler guard: verifies there is a logged-in, active user and
 * (optionally) that they hold `permission`. Returns either the resolved
 * user or a ready-to-return NextResponse — callers do
 * `const auth = await authorize(...); if (auth.error) return auth.error;`
 * so authorization is never accidentally skipped.
 */
export async function authorize(permission?: PermissionKey): Promise<AuthorizeResult> {
  const user = await getCurrentUser();
  if (!user) {
    // A deactivated account's still-open tab gets a distinct code so the
    // client can send it to /login with the deactivated notice.
    if (await isCurrentAccountDeactivated()) {
      return { error: apiError(ACCOUNT_DEACTIVATED_MESSAGE, "ACCOUNT_DEACTIVATED", 401) };
    }
    return { error: apiUnauthorized() };
  }
  if (permission && !hasPermission(user, permission)) return { error: apiForbidden() };
  return { user };
}
