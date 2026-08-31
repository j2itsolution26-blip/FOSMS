import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getCheckoutFolioSummary } from "@/services/front-office.service";

type RouteContext = { params: Promise<{ reservationId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_VIEW);
  if (auth.error) return auth.error;

  const { reservationId } = await params;
  try {
    const summary = await getCheckoutFolioSummary(reservationId);
    return apiSuccess(summary);
  } catch (err) {
    return handleServiceError(err, "front-office/check-out/folio-summary");
  }
}
