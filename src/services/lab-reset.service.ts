import "server-only";
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
};

/**
 * Read-only preview of exactly what a reset would remove — used to show the
 * Supervisor a count before they ever see the confirmation dialog. Not
 * transactional (a plain read): a few rows created between this call and the
 * actual reset just means the reset's own after-the-fact count (computed
 * fresh, inside its own transaction) may differ slightly, which is fine —
 * this is a preview, not a lock.
 */
export async function getLabResetPreview(): Promise<LabResetCounts> {
  const [guests, reservations, checkIns, checkOuts, cashierTransactions, cashierSessions, serviceRequests] =
    await Promise.all([
      prisma.guest.count(),
      prisma.reservation.count(),
      prisma.checkIn.count(),
      prisma.checkOut.count(),
      prisma.cashierTransaction.count(),
      prisma.cashierSession.count(),
      prisma.serviceRequest.count({ where: { guestId: { not: null } } }),
    ]);

  return { guests, reservations, checkIns, checkOuts, cashierTransactions, cashierSessions, serviceRequests };
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
 *      first frees the reservationId FK (blocks Reservation) and sessionId
 *      FK (blocks CashierSession) it holds.
 *   3-4. CheckIn / CheckOut — each holds a required reservationId FK that
 *      would otherwise block deleting the Reservation.
 *   5. Reservation — safe now that CashierTransaction/CheckIn/CheckOut no
 *      longer reference it. Freeing this row is what unblocks Guest (its
 *      own required guestId FK) next.
 *   6. CashierSession — safe now that CashierTransaction no longer
 *      references it.
 *   7. Guest — safe now that Reservation and (guest-scoped) ServiceRequest
 *      no longer reference it. GuestDocument cascades automatically
 *      (onDelete: Cascade in schema.prisma), so it needs no explicit step.
 *
 * Deliberately NOT touched: NightAudit, ClubReception, RoomStatusHistory,
 * Notification, AuditLog — none of them carry a real FK to Guest/
 * Reservation/CashierTransaction (nothing here can leave them orphaned or
 * block this transaction), and none were named in the reset's scope.
 * AuditLog in particular is a permanent record and is never pruned by this
 * operation — including the very entry this function writes about itself.
 */
export async function resetLaboratoryData(actor: ActorContext): Promise<LabResetCounts> {
  const counts = await prisma.$transaction(async (tx) => {
    const guests = await tx.guest.count();
    const reservations = await tx.reservation.count();
    const checkIns = await tx.checkIn.count();
    const checkOuts = await tx.checkOut.count();
    const cashierTransactions = await tx.cashierTransaction.count();
    const cashierSessions = await tx.cashierSession.count();
    const serviceRequests = await tx.serviceRequest.count({ where: { guestId: { not: null } } });

    await tx.serviceRequest.deleteMany({ where: { guestId: { not: null } } });
    await tx.cashierTransaction.deleteMany({});
    await tx.checkIn.deleteMany({});
    await tx.checkOut.deleteMany({});
    await tx.reservation.deleteMany({});
    await tx.cashierSession.deleteMany({});
    await tx.guest.deleteMany({});

    return { guests, reservations, checkIns, checkOuts, cashierTransactions, cashierSessions, serviceRequests };
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
