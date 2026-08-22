import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listAssessableTrainees, listAssessors } from "@/services/assessment.service";
import { listCompetencies } from "@/services/competency.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_VIEW);
  if (auth.error) return auth.error;

  const [trainees, assessors, competencies] = await Promise.all([listAssessableTrainees(), listAssessors(), listCompetencies()]);
  return apiSuccess({ trainees, assessors, competencies });
}
