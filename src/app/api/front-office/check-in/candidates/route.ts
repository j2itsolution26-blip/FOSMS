import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { listCheckInEligibleReservations } from "@/services/front-office.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_VIEW);
  if (auth.error) return auth.error;

  try {
    const reservations = await listCheckInEligibleReservations();
    return apiSuccess(reservations);
  } catch (err) {
    return handleServiceError(err, "front-office/check-in/candidates");
  }
}
