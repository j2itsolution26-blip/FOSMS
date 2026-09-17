import "server-only";
import type { Prisma, RoomStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { RESTRICTED_ROOM_STATUSES } from "@/config/room-status";

/** The vacant status every room is returned to by a reset — see the detailed
 * note in resetLaboratoryData() for why this is VC and not V. */
const LAB_RESET_ROOM_STATUS: RoomStatus = "VC";

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
 * genuinely clean slate. Never DELETES anything outside that operational
 * set — User/Role/Permission, Room/RoomType, SystemSetting and every other
 * configuration/reference row survives untouched. The single exception is
 * Room.status, which is *updated* (never deleted, and no other room column
 * is written) back to vacant at the end, because that column is the one
 * piece of deleted-stay state that lives outside the deleted tables — see
 * the step after the deletion order below.
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
  const { counts, roomsReset } = await prisma.$transaction(async (tx) => {
    const before = await countLabData(tx);

    await tx.serviceRequest.deleteMany({ where: { guestId: { not: null } } });
    // Special Requests reference both Reservation and CashierTransaction.
    await tx.specialRequest.deleteMany({});
    await tx.cashierTransaction.deleteMany({});
    await tx.checkIn.deleteMany({});
    await tx.checkOut.deleteMany({});
    await tx.reservation.deleteMany({});
    await tx.cashierSession.deleteMany({});
    await tx.clubMembership.deleteMany({});
    await tx.guest.deleteMany({});

    // Rooms themselves are never deleted — only the one operational column
    // that the deleted stay data left behind. Without this, every room a lab
    // section checked into stays OC/OD/VD forever: the reservations that
    // explained those statuses are gone, but the rooms still read "occupied",
    // so the next section opens to a property with no clean rooms.
    //
    // LAB_RESET_ROOM_STATUS is VC, not V: `V` is literally labelled "Vacant",
    // but only VC/VR/VCI are in ASSIGNABLE_ROOM_STATUSES (config/room-status.ts),
    // so a room parked on `V` is invisible to every room picker and refused by
    // checkIn() — a "clean slate" nothing could actually be booked into. VC
    // ("Vacant and Cleaned") is also exactly what Room.status defaults to for a
    // newly created room (schema.prisma), which is the state this restores.
    // Scoped to rooms not already VC purely so the count reflects real changes.
    const { count } = await tx.room.updateMany({
      where: { status: { not: LAB_RESET_ROOM_STATUS } },
      data: { status: LAB_RESET_ROOM_STATUS },
    });

    return { counts: before, roomsReset: count };
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
    // roomsReset is audited but deliberately kept out of the returned
    // LabResetCounts: that type drives the page's "to delete" list, and no
    // room is ever deleted — surfacing it there would read as one.
    newValue: { ...counts, roomsReset },
  });

  return counts;
}

// ---------------------------------------------------------------------------
// Per-account laboratory reset (Staff / Accounts → Reset Laboratory Data).
//
// Removes ONLY the operational records owned by one Front Desk trainee
// account — the same ownership keys the data-isolation layer uses (see
// src/lib/auth/data-scope.ts): the reservations and guests that account
// created, and everything that hangs off them. Every other account's data,
// every user/role/permission, rooms, room types, rates and settings are left
// untouched. The account itself is never deactivated.
// ---------------------------------------------------------------------------

export type AccountLabResetCounts = {
  guests: number;
  reservations: number;
  checkIns: number;
  checkOuts: number;
  cashierTransactions: number;
  cashierSessions: number;
  clubMemberships: number;
  specialRequests: number;
  serviceRequests: number;
};

type AccountLabScope = {
  guestIds: string[];
  reservationIds: string[];
  transactionIds: string[];
  clubMembershipIds: string[];
  sessionIds: string[];
  roomIds: string[];
  counts: AccountLabResetCounts;
  /** This account's guests kept because another account has records on them. */
  retainedGuests: number;
};

export class AccountLabResetConflictError extends AppError {
  constructor(message: string) {
    super(message, "LAB_RESET_CROSS_ACCOUNT", 409);
  }
}

/**
 * Resolves exactly which rows belong to `userId`'s laboratory data. Shared by
 * the preview and the reset (run inside its transaction), so the counts the
 * Supervisor confirms are the rows that get deleted.
 *
 * Ownership, account by account — never a table-wide delete:
 *  - Reservations: createdById = account; their check-ins, check-outs, special
 *    requests and every folio transaction on them go with them.
 *  - Guests: createdById = account, EXCEPT a guest another account still has a
 *    reservation, club membership or concierge request on (legacy data from
 *    before isolation) — that guest is kept, never deleted from under them.
 *  - Club memberships: those of the account's deletable guests; their fee
 *    payments go with them.
 *  - Cashier sessions: the account's own, once no transaction remains in them.
 * If any transaction in that set is linked to a record outside it (another
 * account's charge/payment), nothing is deleted.
 */
async function resolveAccountLabScope(client: Prisma.TransactionClient, userId: string): Promise<AccountLabScope> {
  const reservations = await client.reservation.findMany({
    where: { createdById: userId },
    select: { id: true, roomId: true },
  });
  const reservationIds = reservations.map((r) => r.id);

  const ownGuests = await client.guest.findMany({
    where: { createdById: userId },
    select: {
      id: true,
      reservations: { where: { createdById: { not: userId } }, select: { id: true }, take: 1 },
      clubMembership: { select: { registeredById: true } },
      serviceRequests: { where: { NOT: { createdById: userId } }, select: { id: true }, take: 1 },
    },
  });
  const deletableGuests = ownGuests.filter(
    (g) =>
      g.reservations.length === 0 &&
      g.serviceRequests.length === 0 &&
      (!g.clubMembership || g.clubMembership.registeredById === userId)
  );
  const guestIds = deletableGuests.map((g) => g.id);

  const memberships = await client.clubMembership.findMany({
    where: { guestId: { in: guestIds } },
    select: { id: true },
  });
  const clubMembershipIds = memberships.map((m) => m.id);

  const transactions = await client.cashierTransaction.findMany({
    where: {
      OR: [{ reservationId: { in: reservationIds } }, { clubMembershipId: { in: clubMembershipIds } }],
    },
    select: {
      id: true,
      reservationId: true,
      clubMembershipId: true,
      settlesTransactionId: true,
      sessionId: true,
      settledBy: { select: { id: true } },
    },
  });
  const transactionIds = new Set(transactions.map((t) => t.id));
  const reservationSet = new Set(reservationIds);
  const membershipSet = new Set(clubMembershipIds);
  for (const t of transactions) {
    const linksOutside =
      (t.settlesTransactionId && !transactionIds.has(t.settlesTransactionId)) ||
      t.settledBy.some((s) => !transactionIds.has(s.id)) ||
      (t.reservationId && !reservationSet.has(t.reservationId)) ||
      (t.clubMembershipId && !membershipSet.has(t.clubMembershipId));
    if (linksOutside) {
      throw new AccountLabResetConflictError(
        "This account's laboratory data is linked to another account's records, so nothing was reset. Use the Supervisor Laboratory Data reset instead."
      );
    }
  }

  // The account's own cashier sessions, kept only if they would still hold a
  // transaction that isn't part of this reset.
  const ownSessions = await client.cashierSession.findMany({
    where: { cashierId: userId },
    select: { id: true, transactions: { where: { id: { notIn: [...transactionIds] } }, select: { id: true }, take: 1 } },
  });
  const sessionIds = ownSessions.filter((s) => s.transactions.length === 0).map((s) => s.id);

  const [checkIns, checkOuts, specialRequests, serviceRequests] = await Promise.all([
    client.checkIn.count({ where: { reservationId: { in: reservationIds } } }),
    client.checkOut.count({ where: { reservationId: { in: reservationIds } } }),
    client.specialRequest.count({ where: { reservationId: { in: reservationIds } } }),
    client.serviceRequest.count({ where: { guestId: { in: guestIds } } }),
  ]);

  return {
    guestIds,
    reservationIds,
    transactionIds: [...transactionIds],
    clubMembershipIds,
    sessionIds,
    roomIds: [...new Set(reservations.map((r) => r.roomId))],
    counts: {
      guests: guestIds.length,
      reservations: reservationIds.length,
      checkIns,
      checkOuts,
      cashierTransactions: transactionIds.size,
      cashierSessions: sessionIds.length,
      clubMemberships: clubMembershipIds.length,
      specialRequests,
      serviceRequests,
    },
    retainedGuests: ownGuests.length - deletableGuests.length,
  };
}

/** Read-only: what a reset of this one account would remove. */
export async function getAccountLabResetPreview(userId: string) {
  const scope = await resolveAccountLabScope(prisma, userId);
  return { counts: scope.counts, retainedGuests: scope.retainedGuests };
}

/**
 * Deletes one account's laboratory data in a single all-or-nothing
 * transaction (children before parents, same FK order as
 * resetLaboratoryData), then returns the rooms that data used to Vacant
 * (VC) — except a room another account currently has a stay in, or one a
 * Supervisor has taken out of service (OOO/BLO).
 */
export async function resetAccountLaboratoryData(
  target: { id: string; name: string; email: string },
  actor: ActorContext
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const scope = await resolveAccountLabScope(tx, target.id);
      const { guestIds, reservationIds, transactionIds, clubMembershipIds, sessionIds } = scope;

      await tx.serviceRequest.deleteMany({ where: { guestId: { in: guestIds } } });
      await tx.specialRequest.deleteMany({ where: { reservationId: { in: reservationIds } } });
      // One statement, so the settlement self-reference inside the set is fine.
      await tx.cashierTransaction.deleteMany({ where: { id: { in: transactionIds } } });
      await tx.checkIn.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await tx.checkOut.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await tx.reservation.deleteMany({ where: { id: { in: reservationIds }, createdById: target.id } });
      await tx.cashierSession.deleteMany({ where: { id: { in: sessionIds }, cashierId: target.id } });
      await tx.clubMembership.deleteMany({ where: { id: { in: clubMembershipIds } } });
      await tx.guest.deleteMany({ where: { id: { in: guestIds }, createdById: target.id } });

      const { count: roomsReset } = await tx.room.updateMany({
        where: {
          id: { in: scope.roomIds },
          status: { notIn: [LAB_RESET_ROOM_STATUS, ...RESTRICTED_ROOM_STATUSES] },
          reservations: { none: { status: "CHECKED_IN" } },
        },
        data: { status: LAB_RESET_ROOM_STATUS },
      });

      const after = await resolveAccountLabScope(tx, target.id);
      return { deleted: scope.counts, after: after.counts, retainedGuests: after.retainedGuests, roomsReset };
    },
    { timeout: 30_000 }
  );

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "LABORATORY_DATA_RESET",
    module: "administration",
    recordId: target.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      scope: "ACCOUNT",
      account: target.name,
      email: target.email,
      ...result.deleted,
      roomsReset: result.roomsReset,
    },
  });

  return result;
}
