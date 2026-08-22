import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { gradeSubmissionSchema } from "@/validators/training-activity.schema";
import { gradeSubmission } from "@/services/training-activity.service";

type RouteContext = { params: Promise<{ id: string; submissionId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_MANAGE);
  if (auth.error) return auth.error;

  const { submissionId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = gradeSubmissionSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const submission = await gradeSubmission(submissionId, parsed.data.score, parsed.data.remarks, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(submission);
  } catch (err) {
    return handleServiceError(err, "training-activities/grade");
  }
}
