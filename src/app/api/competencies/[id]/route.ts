import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { competencySchema } from "@/validators/competency.schema";
import { updateCompetency } from "@/services/competency.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.COMPETENCIES_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = competencySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const competency = await updateCompetency(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(competency);
  } catch (err) {
    return handleServiceError(err, "competencies/update");
  }
}
