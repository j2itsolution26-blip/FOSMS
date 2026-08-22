import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { clubReceptionSchema } from "@/validators/club-reception.schema";
import { createReception } from "@/services/club-reception.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = clubReceptionSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const record = await createReception(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(record, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "club-reception/create");
  }
}
