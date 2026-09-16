import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { checkOutClubMembershipPaymentSchema } from "@/validators/front-office.schema";
import { registerClubMembershipAtCheckOut } from "@/services/front-office.service";

type RouteContext = { params: Promise<{ reservationId: string }> };

/**
 * Check-Out's "Register as Club Member" payment. Takes money, so it's gated
 * by the same permission as the Check-Out modal's existing Process Payment
 * (POST /api/cashiering/transactions).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.CASHIERING_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = checkOutClubMembershipPaymentSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { reservationId } = await params;
  try {
    const result = await registerClubMembershipAtCheckOut(reservationId, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(result);
  } catch (err) {
    return handleServiceError(err, "front-office/check-out/club-membership");
  }
}
