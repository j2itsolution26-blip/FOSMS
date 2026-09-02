import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { createGuestFolioSchema } from "@/validators/guest-folio.schema";
import { createGuestFolioWithReservationAndCharge } from "@/services/guest.service";

/**
 * Atomic Guest Folio create: Guest + (optional) Reservation + initial
 * Cashiering charge in a single request/DB transaction — see
 * createGuestFolioWithReservationAndCharge(). Replaces the old client flow
 * of three separate POSTs (/api/guests, /api/reservations,
 * /api/cashiering/transactions), which could leave a Reservation with no
 * charge (invisible to Cashiering) if the last call failed or raced ahead of
 * a still-loading price quote.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.GUESTS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createGuestFolioSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  // A room assignment also creates a Reservation and its initial Cashiering
  // charge, so it needs the same permissions the old three-call flow needed
  // for those two steps.
  if (parsed.data.room) {
    if (!hasPermission(auth.user, PERMISSIONS.RESERVATIONS_CREATE)) return apiForbidden();
    if (!hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE)) return apiForbidden();
  }
  // checkInNow (Walk-In) also performs the Front Office check-in step, so it
  // needs the same permission the old standalone Walk-In flow required.
  if (parsed.data.checkInNow && !hasPermission(auth.user, PERMISSIONS.FRONT_OFFICE_MANAGE)) return apiForbidden();

  const meta = getRequestMeta(req);

  try {
    const result = await createGuestFolioWithReservationAndCharge(
      parsed.data.guest,
      parsed.data.room ?? null,
      { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...meta },
      { checkInNow: parsed.data.checkInNow }
    );
    return apiSuccess(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "guests/folio/create");
  }
}
