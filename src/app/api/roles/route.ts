import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasAnyPermission } from "@/lib/auth/session";
import { apiForbidden } from "@/lib/api-response";
import { PERMISSIONS } from "@/config/permissions";
import { listRolesWithPermissions } from "@/services/role.service";

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  if (!hasAnyPermission(auth.user, [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE])) {
    return apiForbidden();
  }

  const roles = await listRolesWithPermissions();
  return apiSuccess(roles);
}
