import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getClubMembershipSummary } from "@/services/club-membership.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Whether an existing guest (selected in the Guest Folio / Walk-In forms) is
 * an active Club Member — gated by GUESTS_VIEW (not Club Reception's own
 * permission) since Front Desk staff creating a folio need this regardless
 * of whether they can otherwise manage Club Reception.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.GUESTS_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const summary = await getClubMembershipSummary(id);
    return apiSuccess(summary);
  } catch (err) {
    return handleServiceError(err, "guests/club-membership");
  }
}
