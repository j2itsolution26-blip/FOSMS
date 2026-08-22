import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getTrainingActivityKpis } from "@/services/training-activity.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const kpis = await getTrainingActivityKpis();
  return apiSuccess(kpis);
}
