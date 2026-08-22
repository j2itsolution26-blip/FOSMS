import "server-only";
import { redirect } from "next/navigation";

import { getCurrentUser, hasPermission, type SessionUser } from "@/lib/auth/session";
import type { PermissionKey } from "@/config/permissions";

/**
 * Page-level authorization guard. Redirects to /login if unauthenticated (the
 * sidebar already hides links the user can't reach, but that's UX only —
 * this is the actual enforcement for anyone who types the URL directly).
 * Returns null when the user lacks `permission` so the page can render
 * <AccessDenied />.
 */
export async function requirePagePermission(permission: PermissionKey): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, permission)) return null;
  return user;
}
