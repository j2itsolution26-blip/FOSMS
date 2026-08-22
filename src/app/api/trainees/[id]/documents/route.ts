import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { uploadTraineeDocument } from "@/services/trainee.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINEES_UPDATE);
  if (auth.error) return auth.error;

  const { id } = await params;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const label = formData?.get("label");
  if (!(file instanceof File) || typeof label !== "string" || !label.trim()) {
    return apiError("A file and label are required.", "VALIDATION_ERROR", 422);
  }

  try {
    const document = await uploadTraineeDocument(id, file, label.trim(), {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(document, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "trainees/documents/upload");
  }
}
