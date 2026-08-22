import type { NextRequest } from "next/server";

import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { createTrainingActivitySchema } from "@/validators/training-activity.schema";
import { createActivity, listTrainingActivities } from "@/services/training-activity.service";
import type { TrainingActivityStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const { searchParams } = req.nextUrl;
  const pagination = parsePagination(searchParams);
  const status = searchParams.get("status") || undefined;
  const competencyId = searchParams.get("competencyId") || undefined;
  const instructorId = searchParams.get("instructorId") || undefined;

  const { rows, meta } = await listTrainingActivities(pagination, {
    status: status as TrainingActivityStatus | undefined,
    competencyId,
    instructorId,
  });

  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_MANAGE);
  if (auth.error) return auth.error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError("A valid form submission is required.", "VALIDATION_ERROR", 422);

  const payload = {
    instructorId: String(formData.get("instructorId") ?? ""),
    competencyId: String(formData.get("competencyId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    instructions: String(formData.get("instructions") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
  };
  const parsed = createTrainingActivitySchema.safeParse(payload);
  if (!parsed.success) return apiValidationError(parsed.error);

  const file = formData.get("file");

  try {
    const activity = await createActivity(parsed.data, file instanceof File ? file : null, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(activity, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "training-activities/create");
  }
}
