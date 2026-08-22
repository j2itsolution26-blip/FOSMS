import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { updateTrainingActivitySchema } from "@/validators/training-activity.schema";
import { getTrainingActivityById, updateActivity } from "@/services/training-activity.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const activity = await getTrainingActivityById(id);
    return apiSuccess(activity);
  } catch (err) {
    return handleServiceError(err, "training-activities/get");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = updateTrainingActivitySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const activity = await updateActivity(id, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(activity);
  } catch (err) {
    return handleServiceError(err, "training-activities/update");
  }
}
