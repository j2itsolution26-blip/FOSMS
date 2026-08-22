import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { addEvidenceSchema, evidenceTypeEnum } from "@/validators/assessment.schema";
import { addEvidence } from "@/services/assessment.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_EVALUATE);
  if (auth.error) return auth.error;

  const { id } = await params;

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError("Invalid form submission.", "VALIDATION_ERROR", 422);

  const type = evidenceTypeEnum.safeParse(formData.get("type"));
  if (!type.success) return apiError("A valid evidence type is required.", "VALIDATION_ERROR", 422);

  const description = formData.get("description");
  const parsed = addEvidenceSchema.safeParse({
    type: type.data,
    description: typeof description === "string" ? description : "",
  });
  if (!parsed.success) return apiError("Invalid evidence details.", "VALIDATION_ERROR", 422);

  const file = formData.get("file");

  try {
    const evidence = await addEvidence(id, parsed.data, file instanceof File && file.size > 0 ? file : null, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(evidence, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "assessments/evidence/add");
  }
}
