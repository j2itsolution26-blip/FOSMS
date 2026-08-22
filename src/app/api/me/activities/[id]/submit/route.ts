import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { submitActivitySchema } from "@/validators/trainee-portal.schema";
import { submitMyActivity } from "@/services/trainee-portal.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const { id } = await params;

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError("Expected multipart form data.", "VALIDATION_ERROR", 422);

  const file = formData.get("file");
  const parsed = submitActivitySchema.safeParse({ remarks: formData.get("remarks") ?? undefined });
  if (!parsed.success) return apiError("Invalid submission.", "VALIDATION_ERROR", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));

  try {
    const submission = await submitMyActivity(
      auth.trainee.id,
      id,
      parsed.data.remarks,
      file instanceof File ? file : null,
      { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) }
    );
    return apiSuccess(submission);
  } catch (err) {
    return handleServiceError(err, "me/activities/submit");
  }
}
