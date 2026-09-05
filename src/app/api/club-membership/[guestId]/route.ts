import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getGuestFinancialHistory } from "@/services/club-membership.service";

type RouteContext = { params: Promise<{ guestId: string }> };

/**
 * A guest's Club Membership + full financial history — used by the
 * "already a member" view in club-membership-dialog.tsx (existing-member
 * protection: shows the real membership instead of just an error) and by
 * anything else that needs to look one up by guest id.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
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
