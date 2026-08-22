import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { createServiceRequestSchema } from "@/validators/concierge.schema";
import { createServiceRequest } from "@/services/concierge.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CONCIERGE_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createServiceRequestSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const request = await createServiceRequest(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(request, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "concierge/requests/create");
  }
}
