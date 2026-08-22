import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { REPORT_TYPES } from "@/services/report.service";
import { listBatches } from "@/services/trainee.service";
import { listCompetencies } from "@/services/competency.service";
import { listAssessors } from "@/services/assessment.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.REPORTS_VIEW);
  if (auth.error) return auth.error;

  const [batches, competencies, assessors] = await Promise.all([listBatches(), listCompetencies(), listAssessors()]);
  return apiSuccess({ reportTypes: REPORT_TYPES, batches, competencies, assessors });
}
