import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { updateTraineeSchema } from "@/validators/trainee.schema";
import { getTraineeById, updateTrainee } from "@/services/trainee.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const trainee = await getTraineeById(id);
    return apiSuccess(trainee);
  } catch (err) {
    return handleServiceError(err, "trainees/get");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINEES_UPDATE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = updateTraineeSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const trainee = await updateTrainee(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(trainee);
  } catch (err) {
    return handleServiceError(err, "trainees/update");
  }
}
