import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { assignServiceRequestSchema } from "@/validators/concierge.schema";
import { assignServiceRequest } from "@/services/concierge.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.CONCIERGE_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = assignServiceRequestSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const request = await assignServiceRequest(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(request);
  } catch (err) {
    return handleServiceError(err, "concierge/requests/assign");
  }
}
