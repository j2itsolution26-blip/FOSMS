import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { cancelAssessment } from "@/services/assessment.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_EVALUATE);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const assessment = await cancelAssessment(id, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(assessment);
  } catch (err) {
    return handleServiceError(err, "assessments/cancel");
  }
}
