import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getAssessmentKpis } from "@/services/assessment.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_VIEW);
  if (auth.error) return auth.error;

  const kpis = await getAssessmentKpis();
  return apiSuccess(kpis);
}
