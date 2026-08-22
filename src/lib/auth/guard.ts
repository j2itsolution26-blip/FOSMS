import "server-only";
import { getCurrentUser, hasPermission, type SessionUser } from "@/lib/auth/session";
import { apiForbidden, apiUnauthorized } from "@/lib/api-response";
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
  if (!user) return { error: apiUnauthorized() };
  if (permission && !hasPermission(user, permission)) return { error: apiForbidden() };
  return { user };
}
