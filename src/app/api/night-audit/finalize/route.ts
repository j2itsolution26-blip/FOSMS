import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { finalizeNightAudit } from "@/services/night-audit.service";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.NIGHT_AUDIT_MANAGE);
  if (auth.error) return auth.error;

  try {
    const audit = await finalizeNightAudit({
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(audit);
  } catch (err) {
    return handleServiceError(err, "night-audit/finalize");
  }
}
