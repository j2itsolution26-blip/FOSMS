import type { NextRequest } from "next/server";

import { apiNotFound, apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { deleteMyDocument } from "@/services/trainee-portal.service";

type RouteContext = { params: Promise<{ kind: string; id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const { kind, id } = await params;
  if (kind !== "document") return apiNotFound("Only trainee-uploaded documents can be deleted.");

  try {
    await deleteMyDocument(auth.trainee.id, id, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(_req),
    });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleServiceError(err, "me/evidence/delete");
  }
}
