import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getTraineeKpis } from "@/services/trainee.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const kpis = await getTraineeKpis();
  return apiSuccess(kpis);
}
