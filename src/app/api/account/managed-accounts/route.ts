import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { handleServiceError } from "@/lib/handle-service-error";
import { listManagedAccounts } from "@/services/account.service";

/** The trainee accounts a Supervisor may issue a new password for. Never
 * returns password material of any kind — see listManagedAccounts. */
export async function GET() {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  try {
    const accounts = await listManagedAccounts();
    return apiSuccess(accounts);
  } catch (err) {
    return handleServiceError(err, "account/managed-accounts");
  }
}
