import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { createWalkInGuestSchema } from "@/validators/guest-folio.schema";
import { createWalkInGuestFolio } from "@/services/guest.service";

/**
 * Walk-In Guest: the same atomic guest+reservation+charge creation as
 * /api/guests/folio, plus an immediate check-in — see
 * createWalkInGuestFolio() in guest.service.ts. Room assignment is mandatory
 * here (unlike the Guest Folio's optional toggle), so this always needs
 * reservation/cashiering permissions on top of guest-management, not just
 * conditionally like the folio route.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.GUESTS_MANAGE);
  if (auth.error) return auth.error;
  if (
    !hasPermission(auth.user, PERMISSIONS.RESERVATIONS_CREATE) ||
    !hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE) ||
    !hasPermission(auth.user, PERMISSIONS.FRONT_OFFICE_MANAGE)
  ) {
    return apiForbidden();
  }

  const json = await req.json().catch(() => null);
  const parsed = createWalkInGuestSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    const result = await createWalkInGuestFolio(parsed.data.guest, parsed.data.room, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });
    return apiSuccess(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "front-office/walk-in");
  }
}
