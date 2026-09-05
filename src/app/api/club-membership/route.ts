import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { registerClubMembershipSchema } from "@/validators/club-membership.schema";
import { registerClubMembership, listClubMembers, type ClubMemberStatusFilter } from "@/services/club-membership.service";
import { parsePagination } from "@/validators/pagination.schema";

/** The dedicated Club Members list (separate from Guests / Today's Club Reception). */
export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (auth.error) return auth.error;

  const pagination = parsePagination(req.nextUrl.searchParams);
  const statusParam = req.nextUrl.searchParams.get("status");
  const status: ClubMemberStatusFilter | undefined =
    statusParam === "ACTIVE" || statusParam === "UNPAID" ? statusParam : undefined;

  try {
    const result = await listClubMembers(pagination, { status });
    return apiSuccess(result.rows, result.meta);
  } catch (err) {
    return handleServiceError(err, "club-membership/list");
  }
}

/**
 * Registers a Club Membership and its one-time ₱1,000 fee payment in one
 * atomic request — mirrors /api/guests/folio's "one request, one DB
 * transaction" shape so a membership can never be created without its
 * payment (or vice versa).
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_MANAGE);
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user, PERMISSIONS.CASHIERING_MANAGE)) return apiForbidden();

  const json = await req.json().catch(() => null);
  const parsed = registerClubMembershipSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  // Creating a brand-new guest here needs the same permission Guest
  // Folio/Walk-In already require for creating one.
  if (parsed.data.newGuest && !hasPermission(auth.user, PERMISSIONS.GUESTS_MANAGE)) return apiForbidden();

  const meta = getRequestMeta(req);

  try {
    const result = await registerClubMembership(parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });
    return apiSuccess(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "club-membership/register");
  }
}
