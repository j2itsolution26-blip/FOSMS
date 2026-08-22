import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { guestVerificationSchema } from "@/validators/front-office.schema";
import { verifyGuest } from "@/services/front-office.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = guestVerificationSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const result = await verifyGuest(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(result);
  } catch (err) {
    return handleServiceError(err, "front-office/verify-guest");
  }
}
