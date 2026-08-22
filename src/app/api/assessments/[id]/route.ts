import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getAssessmentById } from "@/services/assessment.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const assessment = await getAssessmentById(id);
    return apiSuccess(assessment);
  } catch (err) {
    return handleServiceError(err, "assessments/get");
  }
}
