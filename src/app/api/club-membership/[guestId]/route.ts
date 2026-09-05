import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getGuestFinancialHistory } from "@/services/club-membership.service";

type RouteParams = { params: Promise<{ guestId: string }> };

/**
 * A guest/member's combined financial history (Membership + every
 * Guest/Room/Walk-In transaction) — read-only, powers Club Reception's
 * Financial History section and the Combined Receipt. Never creates or
 * modifies a transaction.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (auth.error) return auth.error;

  const { guestId } = await params;

  try {
    const history = await getGuestFinancialHistory(guestId);
    return apiSuccess(history);
  } catch (err) {
    return handleServiceError(err, "club-membership/financial-history");
  }
}
