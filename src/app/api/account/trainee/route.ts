import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { handleServiceError } from "@/lib/handle-service-error";
import { getTraineeAccount } from "@/services/account.service";

/** The single Trainee / Candidate account a Supervisor may issue a new
 * password for. Never returns password material of any kind — see
 * getTraineeAccount. */
export async function GET() {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  try {
    return apiSuccess(await getTraineeAccount());
  } catch (err) {
    return handleServiceError(err, "account/trainee");
  }
}
