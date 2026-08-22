import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listPermissionCatalog } from "@/services/role.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.ROLES_MANAGE);
  if (auth.error) return auth.error;

  const permissions = await listPermissionCatalog();
  return apiSuccess(permissions);
}
