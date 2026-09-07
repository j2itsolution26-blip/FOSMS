import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

export type LabResetCounts = {
  guests: number;
  reservations: number;
  checkIns: number;
  checkOuts: number;
  cashierTransactions: number;
  cashierSessions: number;
  serviceRequests: number;
  clubMemberships: number;
};

/**
 * The ONE place that defines what counts as laboratory/test operational
 * data — both the read-only preview (getLabResetPreview, called with the
 * plain `prisma` client) and the actual reset (resetLaboratoryData, called
 * with its open `tx`) run this exact same set of counts, so they can never
 * disagree about what exists. Accepts `Prisma.TransactionClient` since the
 * top-level `prisma` client is structurally compatible with it for these
 * delegate methods.
 */
async function countLabData(client: Prisma.TransactionClient): Promise<LabResetCounts> {
  const [guests, reservations, checkIns, checkOuts, cashierTransactions, cashierSessions, serviceRequests, clubMemberships] =
    await Promise.all([
      client.guest.count(),
      client.reservation.count(),
      client.checkIn.count(),
      client.checkOut.count(),
      client.cashierTransaction.count(),
      client.cashierSession.count(),
      client.serviceRequest.count({ where: { guestId: { not: null } } }),
      client.clubMembership.count(),
    ]);

  return { guests, reservations, checkIns, checkOuts, cashierTransactions, cashierSessions, serviceRequests, clubMemberships };
}

/**
 * Read-only preview of exactly what a reset would remove — used to show the
 * Supervisor a count before they ever see the confirmation dialog. Not
 * transactional (a plain read): a few rows created between this call and the
 * actual reset just means the reset's own after-the-fact count (computed
 * fresh, inside its own transaction) may differ slightly, which is fine —
 * this is a preview, not a lock. Shares countLabData with the reset itself
 * (see that comment) so the preview and the actual deletion can never drift
 * apart — the bug this whole file was rewritten to fix (see resetLaboratoryData).
 */
export async function getLabResetPreview(): Promise<LabResetCounts> {
  return countLabData(prisma);
}

/**
 * Wipes every guest/reservation/cashiering operational record in one
 * all-or-nothing transaction, so the next lab section starts from a
 * genuinely clean slate. Never touches User/Role/Permission, Room/RoomType,
 * SystemSetting, or any other configuration/reference data — see the
 * deletion order comment below for exactly why each step is safe.
 *
 * Deletion order (children before parents, per the real FK graph in
 * schema.prisma — none of these relations cascade at the DB level, so this
 * order is load-bearing, not cosmetic):
 *   1. ServiceRequest rows tied to a guest (guestId FK would block deleting
 *      that Guest otherwise). ServiceRequests with no guestId are a
 *      different, non-guest-scoped record (e.g. a walk-in concierge request)
 *      and are left alone — reset only removes what "belongs specifically
 *      to the deleted guest/reservation data," per spec.
 *   2. CashierTransaction — every row, in one statement. This table is
 *      self-referential (settlesTransactionId), but Postgres defers FK
 *      checks to the end of the statement, so deleting the entire table in
 *      one DELETE never trips over its own self-reference. Clearing this
 *      first frees the reservationId FK (blocks Reservation), sessionId FK
 *      (blocks CashierSession), and clubMembershipId FK (blocks
 *      ClubMembership) it holds.
 *   3-4. CheckIn / CheckOut — each holds a required reservationId FK that
 *      would otherwise block deleting the Reservation.
 *   5. Reservation — safe now that CashierTransaction/CheckIn/CheckOut no
 *      longer reference it. Freeing this row is what unblocks Guest (its
 *      own required guestId FK) next.
 *   6. CashierSession — safe now that CashierTransaction no longer
 *      references it.
 *   7. ClubMembership — safe now that CashierTransaction no longer
 *      references it (its own clubMembershipId FK). Its guestId FK is what
 *      was previously missing here: any guest with a registered Club
 *      Membership (guestId is @unique on ClubMembership — RESTRICT, no
 *      cascade) blocked step 8 below and rolled back the ENTIRE transaction,
 *      which is exactly why a real preview count could still be followed by
 *      "no data was deleted" — the whole $transaction throws on any single
 *      failing statement, undoing every delete that would otherwise have
 *      succeeded. This step is the fix.
 *   8. Guest — safe now that Reservation, ClubMembership, and (guest-scoped)
 *      ServiceRequest no longer reference it. GuestDocument cascades
 *      automatically (onDelete: Cascade in schema.prisma), so it needs no
 *      explicit step.
 *
 * Deliberately NOT touched: NightAudit, ClubReception, RoomStatusHistory,
 * Notification, AuditLog — none of them carry a real FK to Guest/
 * Reservation/CashierTransaction/ClubMembership (nothing here can leave them
 * orphaned or block this transaction), and none were named in the reset's
 * scope. AuditLog in particular is a permanent record and is never pruned by
 * this operation — including the very entry this function writes about itself.
 */
export async function resetLaboratoryData(actor: ActorContext): Promise<LabResetCounts> {
  const counts = await prisma.$transaction(async (tx) => {
    const before = await countLabData(tx);

    await tx.serviceRequest.deleteMany({ where: { guestId: { not: null } } });
    await tx.cashierTransaction.deleteMany({});
    await tx.checkIn.deleteMany({});
    await tx.checkOut.deleteMany({});
    await tx.reservation.deleteMany({});
    await tx.cashierSession.deleteMany({});
    await tx.clubMembership.deleteMany({});
    await tx.guest.deleteMany({});

    return before;
  });

  // Best-effort, outside the transaction — same convention as every other
  // recordAudit() call in this codebase (see lib/audit.ts): a logging
  // hiccup must never look like the reset itself failed. The reset has
  // already committed by this point, so there is nothing left to roll back.
  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "LABORATORY_DATA_RESET",
    module: "administration",
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { ...counts },
  });

  return counts;
}
