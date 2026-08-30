import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listOpenReservationsForTransactions } from "@/services/cashiering.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.CASHIERING_MANAGE);
  if (auth.error) return auth.error;

  const reservations = await listOpenReservationsForTransactions();
  return apiSuccess(reservations);
}
