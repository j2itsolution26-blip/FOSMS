import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listAssignableStaff } from "@/services/concierge.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.CONCIERGE_MANAGE);
  if (auth.error) return auth.error;

  const staff = await listAssignableStaff();
  return apiSuccess(staff);
}
