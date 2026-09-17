import "server-only";
import type { Prisma, RoleName } from "@prisma/client";

import { AppError, NotFoundError } from "@/lib/errors";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * Per-account data isolation for Front Office Trainee logins (Front Desk A–O).
 *
 * Every trainee practices on the same shared room inventory, but each one
 * only ever sees — and can only ever touch — the operational records their
 * own login created: guests, reservations (and through them check-ins,
 * check-outs, special requests and folios), cashiering transactions, club
 * memberships, club reception visits, concierge requests and their own
 * activity log. Supervisory roles are unscoped so they can supervise every
 * trainee.
 *
 * The scope is always derived server-side from the signed-in session — never
 * from anything the client sends — and every service applies it inside its
 * own database query, so no URL/ID/parameter change can reach another
 * account's rows.
 */
export type DataScope = {
  /** The account whose records are visible, or null for unrestricted (supervisory) access. */
  ownerId: string | null;
};

// Roles that supervise trainees and therefore see every account's records.
const SUPERVISORY_ROLES: RoleName[] = ["SUPERVISOR", "ADMINISTRATOR", "SUPER_ADMIN"];

export const UNRESTRICTED_SCOPE: DataScope = { ownerId: null };

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this record.") {
    super(message, "FORBIDDEN", 403);
  }
}

/** Default-deny: any account without a supervisory role is isolated to its own records. */
export function dataScopeFor(user: Pick<SessionUser, "id" | "roles">): DataScope {
  return user.roles.some((r) => SUPERVISORY_ROLES.includes(r)) ? UNRESTRICTED_SCOPE : { ownerId: user.id };
}

export function isIsolated(scope: DataScope): scope is { ownerId: string } {
  return scope.ownerId !== null;
}

// Matches no row: cuid ids never contain spaces.
const NO_ACCESS_SCOPE: DataScope = { ownerId: "no session" };

/**
 * The signed-in account's scope. Fails closed without a session: every
 * filter matches nothing and every record check is refused. (API routes
 * authorize() before reaching a service; a page rendering for a signed-out
 * user is redirected by the layout, so this quietly returns no data rather
 * than throwing while that redirect happens.)
 */
export async function requireDataScope(): Promise<DataScope> {
  const user = await getCurrentUser();
  if (!user) return NO_ACCESS_SCOPE;
  return dataScopeFor(user);
}

/**
 * Record-level check for an ID supplied by the caller: a missing record is a
 * 404, a record that belongs to another account is a 403.
 */
export function assertOwnedBy(
  scope: DataScope,
  record: { ownerId: string | null | undefined } | null | undefined,
  notFoundMessage = "Record not found."
) {
  if (!record) throw new NotFoundError(notFoundMessage);
  if (isIsolated(scope) && record.ownerId !== scope.ownerId) throw new ForbiddenError();
}

// ---------------------------------------------------------------------------
// Ownership filters — one per table, spread into each query's `where`.
// ---------------------------------------------------------------------------

export function guestWhere(scope: DataScope): Prisma.GuestWhereInput {
  return isIsolated(scope) ? { createdById: scope.ownerId } : {};
}

// Check-ins, check-outs, special requests and folios belong to their reservation.
export function reservationWhere(scope: DataScope): Prisma.ReservationWhereInput {
  return isIsolated(scope) ? { createdById: scope.ownerId } : {};
}

export function transactionWhere(scope: DataScope): Prisma.CashierTransactionWhereInput {
  return isIsolated(scope) ? { userId: scope.ownerId } : {};
}

export function clubMembershipWhere(scope: DataScope): Prisma.ClubMembershipWhereInput {
  return isIsolated(scope) ? { registeredById: scope.ownerId } : {};
}

export function clubReceptionWhere(scope: DataScope): Prisma.ClubReceptionWhereInput {
  return isIsolated(scope) ? { registeredById: scope.ownerId } : {};
}

export function serviceRequestWhere(scope: DataScope): Prisma.ServiceRequestWhereInput {
  return isIsolated(scope) ? { createdById: scope.ownerId } : {};
}

export function specialRequestWhere(scope: DataScope): Prisma.SpecialRequestWhereInput {
  return isIsolated(scope) ? { reservation: { createdById: scope.ownerId } } : {};
}

export function auditLogWhere(scope: DataScope): Prisma.AuditLogWhereInput {
  return isIsolated(scope) ? { userId: scope.ownerId } : {};
}

/**
 * Room status history on a shared room: an isolated account sees its own
 * changes plus system/supervisor changes, never another trainee's (their
 * notes name that trainee's guests and rooms moves).
 */
export function roomStatusHistoryWhere(scope: DataScope): Prisma.RoomStatusHistoryWhereInput {
  if (!isIsolated(scope)) return {};
  return {
    OR: [
      { changedById: null },
      { changedById: scope.ownerId },
      { changedBy: { roles: { some: { role: { name: { in: SUPERVISORY_ROLES } } } } } },
    ],
  };
}

/** "Front Desk A" — how a record's owning account is labelled for supervisors. */
export function ownerLabel(user: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim() || null;
}
