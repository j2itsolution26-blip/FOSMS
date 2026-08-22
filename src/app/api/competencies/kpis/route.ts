import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getCompetencyKpis } from "@/services/competency.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.COMPETENCIES_VIEW);
  if (auth.error) return auth.error;

  const kpis = await getCompetencyKpis();
  return apiSuccess(kpis);
}
