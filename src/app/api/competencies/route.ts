import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { competencySchema } from "@/validators/competency.schema";
import { createCompetency, listCompetenciesWithStats } from "@/services/competency.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.COMPETENCIES_VIEW);
  if (auth.error) return auth.error;

  const competencies = await listCompetenciesWithStats();
  return apiSuccess(competencies);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.COMPETENCIES_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = competencySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const competency = await createCompetency(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(competency, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "competencies/create");
  }
}
