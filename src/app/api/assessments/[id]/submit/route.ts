import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { submitAssessmentSchema } from "@/validators/assessment.schema";
import { submitAssessment } from "@/services/assessment.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_EVALUATE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = submitAssessmentSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const assessment = await submitAssessment(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(assessment);
  } catch (err) {
    return handleServiceError(err, "assessments/submit");
  }
}
