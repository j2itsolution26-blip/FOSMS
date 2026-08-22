import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { checkOutReception } from "@/services/club-reception.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const record = await checkOutReception(id, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(record);
  } catch (err) {
    return handleServiceError(err, "club-reception/check-out");
  }
}
