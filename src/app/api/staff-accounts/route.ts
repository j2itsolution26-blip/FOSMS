import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { handleServiceError } from "@/lib/handle-service-error";
import { listStaffAccounts } from "@/services/staff-account.service";

/** Front Desk A–O with their real status and last sign-in (Supervisor only). */
export async function GET() {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  try {
    return apiSuccess(await listStaffAccounts());
  } catch (err) {
    return handleServiceError(err, "staff-accounts/list");
  }
}
