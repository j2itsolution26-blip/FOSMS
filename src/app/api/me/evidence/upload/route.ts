import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { uploadDocumentSchema } from "@/validators/trainee-portal.schema";
import { uploadMyDocument } from "@/services/trainee-portal.service";

export async function POST(req: NextRequest) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError("Expected multipart form data.", "VALIDATION_ERROR", 422);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("A file is required.", "VALIDATION_ERROR", 422);
  }

  const parsed = uploadDocumentSchema.safeParse({
    label: formData.get("label") ?? undefined,
    category: formData.get("category") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("Validation failed.", "VALIDATION_ERROR", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  try {
    const document = await uploadMyDocument(
      auth.trainee.id,
      file,
      parsed.data.label,
      parsed.data.category,
      parsed.data.description,
      { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) }
    );
    return apiSuccess(document, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "me/evidence/upload");
  }
}
