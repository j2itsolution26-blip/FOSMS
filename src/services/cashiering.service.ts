import "server-only";
import type { PaymentMethod, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import { computeFolioCharge, type FolioCharge } from "@/lib/folio-pricing";
import { formatGuestFullName } from "@/lib/formatters";
import type {
  CloseCashierInput,
  CreateTransactionInput,
  IssueRefundInput,
  OpenCashierInput,
  ReceiptStatus,
} from "@/validators/cashiering.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

/**
 * The Club Member 2% discount's eligibility gate — a guest is an ACTIVE
 * member iff they have a ClubMembership row (guestId is @unique, so there's
 * at most one) AND its one-time fee payment hasn't been reversed. There's no
 * separate status/expiry column (see prisma schema comment on
 * ClubMembership) — "the payment cleared and was never refunded" IS what
 * ACTIVE means here, matching how the rest of Cashiering already treats a
 * reversed payment as no longer counting (see isCompletedPayment()). Defined
 * here (not club-membership.service.ts, which already imports from this
 * file) so reservation.service.ts and this file can both use it without a
 * circular import. Checked server-side wherever discountType: "CLUB_MEMBER"
 * is accepted, so hiding the option in a form is never the only thing
 * stopping a non-member from getting the discount.
 */
export async function isActiveClubMember(guestId: string): Promise<boolean> {
  const membership = await prisma.clubMembership.findUnique({
    where: { guestId },
    select: { transactions: { select: { reversedById: true }, where: { type: "PAYMENT" } } },
  });
  if (!membership) return false;
  return membership.transactions.some((t) => !t.reversedById);
}

export const CLUB_MEMBER_DISCOUNT_ERROR = "Club Member discount is only available to active Club Members.";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function reservationBalance(transactions: { type: string; amount: Prisma.Decimal | number }[]) {
  return transactions.reduce((sum, t) => {
    const amount = Number(t.amount);
    if (t.type === "CHARGE") return sum + amount;
    if (t.type === "PAYMENT" || t.type === "DISCOUNT" || t.type === "REFUND") return sum - amount;
    return sum;
  }, 0);
}

export async function getCashieringKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [todaysTransactions, todaysPayments, todaysRefunds, checkedInReservations] = await Promise.all([
    prisma.cashierTransaction.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.cashierTransaction.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.cashierTransaction.aggregate({
      where: { type: "REFUND", createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN" },
      select: { id: true, transactions: { select: { type: true, amount: true } } },
    }),
  ]);

  const todaysRevenue = Number(todaysPayments._sum.amount ?? 0) - Number(todaysRefunds._sum.amount ?? 0);
  const pendingPayments = checkedInReservations.filter((r) => reservationBalance(r.transactions) > 0).length;

  return { todaysTransactions, todaysRevenue, pendingPayments };
}

/**
 * Total unsettled balance across every reservation still active (not yet
 * checked out or cancelled) — the same reservationBalance() math the
 * check-out gate and cashiering KPIs use, summed instead of counted, so
 * Reports & Analytics never computes this differently than Cashiering does.
 */
export async function getOutstandingBalanceTotal() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
    select: { transactions: { select: { type: true, amount: true } } },
  });
  return reservations.reduce((sum, r) => sum + Math.max(0, reservationBalance(r.transactions)), 0);
}

export async function listTodayTransactions(search = "", range?: { from: Date; to: Date }) {
  const now = new Date();
  const todayStart = range?.from ?? startOfDay(now);
  const todayEnd = range?.to ?? endOfDay(now);
  const searchLower = search.trim();

  const transactions = await prisma.cashierTransaction.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
      // A payment created by "Transact" to settle an existing charge in place
      // is never its own row in this list — it's folded into the charge's
      // own Paid status below instead. See payTransaction().
      settlesTransactionId: null,
      ...(searchLower
        ? {
            OR: [
              { transactionNo: { contains: searchLower, mode: "insensitive" } },
              { reservation: { reservationNo: { contains: searchLower, mode: "insensitive" } } },
              { reservation: { guest: { firstName: { contains: searchLower, mode: "insensitive" } } } },
              { reservation: { guest: { middleName: { contains: searchLower, mode: "insensitive" } } } },
              { reservation: { guest: { lastName: { contains: searchLower, mode: "insensitive" } } } },
              { reservation: { room: { number: { contains: searchLower, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reservation: {
        include: {
          guest: { select: { firstName: true, middleName: true, lastName: true } },
          room: { select: { number: true, roomType: { select: { name: true } } } },
        },
      },
      clubMembership: {
        include: {
          guest: { select: { firstName: true, middleName: true, lastName: true } },
        },
      },
      user: { select: { firstName: true, lastName: true } },
      roomType: { select: { name: true } },
      settledBy: { select: { id: true, amount: true, reversedById: true, createdAt: true } },
    },
    take: 200,
  });

  // A PAYMENT/REFUND row never carries its own discountType (only the CHARGE
  // it settles does) — same gap getReceiptById already backfills for a single
  // receipt; batched here (one extra indexed query, not N+1) for the list.
  const reservationIdsNeedingDiscount = [
    ...new Set(
      transactions
        .filter((t) => (t.type === "PAYMENT" || t.type === "REFUND") && !t.discountType && t.reservationId)
        .map((t) => t.reservationId as string)
    ),
  ];
  const discountByReservation = new Map<
    string,
    Pick<(typeof transactions)[number], "discountType" | "otherDiscountType" | "otherDiscountRate">
  >();
  if (reservationIdsNeedingDiscount.length) {
    const chargesWithDiscount = await prisma.cashierTransaction.findMany({
      where: { reservationId: { in: reservationIdsNeedingDiscount }, type: "CHARGE", discountType: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { reservationId: true, discountType: true, otherDiscountType: true, otherDiscountRate: true },
    });
    for (const c of chargesWithDiscount) {
      if (c.reservationId && !discountByReservation.has(c.reservationId)) {
        discountByReservation.set(c.reservationId, c);
      }
    }
  }

  return transactions.map((t) => {
    const backfill = t.reservationId && discountByReservation.get(t.reservationId);
    const paidAmount = t.settledBy.filter((s) => !s.reversedById).reduce((sum, s) => sum + Number(s.amount), 0);
    return { ...(backfill && !t.discountType ? { ...t, ...backfill } : t), paidAmount };
  });
}

/**
 * Reservations eligible for a manual Cashiering transaction, with each one's
 * real running balance attached — powers the New Transaction dialog's
 * reservation picker/summary/amount pre-fill so it never has to guess or
 * hardcode a balance.
 */
export async function listOpenReservationsForTransactions() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
    orderBy: { createdAt: "desc" },
    include: {
      guest: { select: { firstName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
      transactions: { select: { type: true, amount: true } },
    },
    take: 100,
  });

  return reservations.map((r) => ({
    id: r.id,
    reservationNo: r.reservationNo,
    guest: r.guest,
    room: r.room,
    balance: reservationBalance(r.transactions),
  }));
}

/**
 * The Cashiering queue of guests who still owe money — from the moment a
 * Guest Folio is saved with a room assigned (status PENDING/CONFIRMED,
 * before check-in) straight through check-out. A reservation can end up here
 * with *no* CashierTransaction rows yet at all (nothing charged/paid today),
 * which is exactly the gap listTodayTransactions can't show — it only lists
 * rows that already exist. Uses the same reservationBalance() math as the
 * check-out gate and KPIs so "pending" here never disagrees with them.
 *
 * Eligibility is `transactions.length === 0 || balance > 0` — a reservation
 * with no CashierTransaction rows yet is included (nothing recorded is not
 * the same as nothing owed), and one with a real balance is included, but a
 * reservation whose charges are already fully settled (balance === 0 with at
 * least one CHARGE — including a legitimate ₱0 100%-discounted charge, which
 * has nothing left to collect) is excluded. createReservation() and
 * createGuestFolioWithReservationAndCharge() always create the initial
 * charge atomically with the reservation now, so the empty-transactions case
 * should only ever apply to reservations created before that guarantee
 * existed — it's kept here so those aren't silently hidden.
 *
 * Also resolves `charge`: the specific unpaid CHARGE row (if any) this
 * reservation's balance traces back to, in the same shape the main table
 * uses — so its "Transact" button can settle that exact charge in place
 * (via payTransaction/TransactionSettleDialog) instead of posting a new,
 * unlinked standalone payment that would show up as a second visible row.
 */
export async function getGuestsAwaitingPayment() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
      transactions: {
        select: {
          id: true,
          transactionNo: true,
          type: true,
          amount: true,
          paymentMethod: true,
          otherPaymentMethod: true,
          reversedById: true,
          createdAt: true,
          discountType: true,
          otherDiscountType: true,
          otherDiscountRate: true,
          vatAmount: true,
          processedBy: true,
          roomType: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
          settledBy: { select: { id: true, amount: true, reversedById: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return reservations
    .filter((r) => r.transactions.length === 0 || reservationBalance(r.transactions) > 0)
    .map((r) => {
      const total = r.transactions.reduce((sum, t) => (t.type === "CHARGE" ? sum + Number(t.amount) : sum), 0);
      const paid = r.transactions.reduce((sum, t) => (t.type === "PAYMENT" ? sum + Number(t.amount) : sum), 0);
      const balance = reservationBalance(r.transactions);
      const latestCharge = r.transactions
        .filter((t) => t.type === "CHARGE" && t.discountType)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      // Most recent CHARGE not yet fully settled — falls back to the most
      // recent CHARGE at all if every one happens to already be settled
      // (shouldn't happen while balance > 0, but never leaves Transact with
      // nothing to target).
      const charges = r.transactions.filter((t) => t.type === "CHARGE");
      const targetCharge =
        charges.find((c) => {
          const paidAmount = c.settledBy.filter((s) => !s.reversedById).reduce((sum, s) => sum + Number(s.amount), 0);
          return paidAmount < Number(c.amount) - 0.001;
        }) ?? charges[0] ?? null;

      return {
        id: r.id,
        reservationNo: r.reservationNo,
        status: r.status,
        guestId: r.guestId,
        roomId: r.roomId,
        guest: r.guest,
        room: r.room,
        total,
        paid,
        balance,
        discountType: latestCharge?.discountType ?? null,
        otherDiscountType: latestCharge?.otherDiscountType ?? null,
        otherDiscountRate: latestCharge?.otherDiscountRate ?? null,
        charge: targetCharge
          ? {
              id: targetCharge.id,
              transactionNo: targetCharge.transactionNo,
              type: targetCharge.type,
              amount: targetCharge.amount.toString(),
              paymentMethod: targetCharge.paymentMethod,
              otherPaymentMethod: targetCharge.otherPaymentMethod,
              reversedById: targetCharge.reversedById,
              createdAt: targetCharge.createdAt.toISOString(),
              paidAmount: targetCharge.settledBy
                .filter((s) => !s.reversedById)
                .reduce((sum, s) => sum + Number(s.amount), 0),
              settledBy: targetCharge.settledBy.map((s) => ({
                id: s.id,
                amount: s.amount.toString(),
                reversedById: s.reversedById,
                createdAt: s.createdAt.toISOString(),
              })),
              reservation: {
                id: r.id,
                reservationNo: r.reservationNo,
                guestId: r.guestId,
                roomId: r.roomId,
                guest: r.guest,
                room: r.room,
              },
              user: targetCharge.user,
              roomType: targetCharge.roomType,
              discountType: targetCharge.discountType,
              vatAmount: targetCharge.vatAmount?.toString() ?? null,
              processedBy: targetCharge.processedBy,
            }
          : null,
      };
    });
}

/**
 * Creates the initial CHARGE for a freshly created reservation, inside an
 * already-open DB transaction — the one thing that makes a reservation
 * reachable by getGuestsAwaitingPayment(). Shared by createReservation() and
 * the Guest Folio's atomic createGuestFolioWithReservationAndCharge()
 * (guest.service.ts) so both entry points create a reservation's billing the
 * exact same way instead of two implementations that could drift apart.
 *
 * Idempotent: if this reservation already has a CHARGE (e.g. a retried
 * request after the DB transaction committed but the response was lost),
 * returns the existing one instead of creating a duplicate.
 */
export async function createInitialReservationCharge(
  tx: Prisma.TransactionClient,
  params: {
    reservationId: string;
    userId: string;
    roomTypeId: string;
    charge: FolioCharge;
    // Guest Folio's Mode of Payment, recorded upfront (the charge itself is
    // still money owed, not money received — see the processedBy comment below).
    paymentMethod?: PaymentMethod | null;
    otherPaymentMethod?: string | null;
  }
) {
  const existing = await tx.cashierTransaction.findFirst({
    where: { reservationId: params.reservationId, type: "CHARGE" },
  });
  if (existing) return existing;

  const sessionId = await getOrCreateCashierSession(tx, params.userId);
  const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
  return tx.cashierTransaction.create({
    data: {
      transactionNo,
      sessionId,
      reservationId: params.reservationId,
      type: "CHARGE",
      amount: params.charge.total,
      paymentMethod: params.paymentMethod ?? null,
      otherPaymentMethod: params.otherPaymentMethod || null,
      // Money owed, not money received — starts unprocessed. The cashier
      // types their own name only once they actually take the payment (see
      // payTransaction()); never copied from the actor creating the charge.
      processedBy: null,
      userId: params.userId,
      roomTypeId: params.roomTypeId,
      bedCount: params.charge.bedCount,
      bedCharge: params.charge.bedCharge,
      discountType: params.charge.discountType,
      otherDiscountType: params.charge.otherDiscountType,
      otherDiscountRate: params.charge.otherDiscountRate,
      discountAmount: params.charge.discountAmount,
      subtotal: params.charge.subtotal,
      vatAmount: params.charge.vatAmount,
    },
  });
}

/**
 * The one-time Club Membership fee's own PAYMENT transaction — reservationId
 * is always null (a membership isn't tied to a room stay), clubMembershipId
 * is what Cashiering/reports use to tell it apart from a Guest/Room/Walk-In
 * payment. Reuses the same session/transaction-number plumbing as every
 * other CashierTransaction so it stays individually auditable alongside them.
 */
export async function createClubMembershipPayment(
  tx: Prisma.TransactionClient,
  params: {
    clubMembershipId: string;
    userId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    otherPaymentMethod?: string | null;
    processedBy: string;
  }
) {
  const sessionId = await getOrCreateCashierSession(tx, params.userId);
  const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
  return tx.cashierTransaction.create({
    data: {
      transactionNo,
      sessionId,
      type: "PAYMENT",
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      otherPaymentMethod: params.otherPaymentMethod || null,
      processedBy: params.processedBy,
      userId: params.userId,
      clubMembershipId: params.clubMembershipId,
    },
  });
}

async function getOrCreateCashierSession(tx: Prisma.TransactionClient, userId: string): Promise<string> {
  const existing = await tx.cashierSession.findFirst({
    where: { cashierId: userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.cashierSession.create({
    data: {
      cashierId: userId,
      openingCash: 0,
      closingCash: 0,
      status: "CLOSED",
      closedAt: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

export async function getMyOpenSession(userId: string) {
  return prisma.cashierSession.findFirst({ where: { cashierId: userId, status: "OPEN" } });
}

export async function openCashierSession(input: OpenCashierInput, actor: ActorContext) {
  const existing = await getMyOpenSession(actor.userId);
  if (existing) {
    throw new AppError("You already have an open cashier session.", "SESSION_ALREADY_OPEN", 409);
  }

  const session = await prisma.cashierSession.create({
    data: { cashierId: actor.userId, openingCash: input.openingCash },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CASHIER_OPENED",
    module: "cashiering",
    recordId: session.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { openingCash: input.openingCash },
  });

  return session;
}

export async function closeCashierSession(input: CloseCashierInput, actor: ActorContext) {
  const session = await getMyOpenSession(actor.userId);
  if (!session) {
    throw new AppError("You don't have an open cashier session.", "NO_OPEN_SESSION", 409);
  }

  const cashTransactions = await prisma.cashierTransaction.findMany({
    where: { sessionId: session.id, paymentMethod: "CASH" },
  });
  const cashDelta = cashTransactions.reduce((sum, t) => {
    const amount = Number(t.amount);
    if (t.type === "PAYMENT") return sum + amount;
    if (t.type === "REFUND") return sum - amount;
    return sum;
  }, 0);
  const expectedCash = Number(session.openingCash) + cashDelta;
  const variance = input.closingCash - expectedCash;

  const updated = await prisma.cashierSession.update({
    where: { id: session.id },
    data: { closingCash: input.closingCash, status: "CLOSED", closedAt: new Date() },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CASHIER_CLOSED",
    module: "cashiering",
    recordId: session.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { closingCash: input.closingCash, expectedCash, variance },
  });

  return { session: updated, expectedCash, variance };
}

export async function createTransaction(input: CreateTransactionInput, actor: ActorContext) {
  // The 2% Club Member rate is a benefit of an ACTIVE membership, never a
  // plain discount anyone can pick — verified server-side (same gate
  // resolveInitialReservationCharge uses) so a manual Cashiering charge can't
  // apply it to a non-member even if a client sent it directly.
  if (input.discountType === "CLUB_MEMBER") {
    const reservationForEligibility = await prisma.reservation.findUnique({
      where: { id: input.reservationId },
      select: { guestId: true },
    });
    const eligible = reservationForEligibility ? await isActiveClubMember(reservationForEligibility.guestId) : false;
    if (!eligible) {
      throw new AppError(CLUB_MEMBER_DISCOUNT_ERROR, "NOT_A_CLUB_MEMBER", 403);
    }
  }

  // When a room type is specified, the amount is server-computed from
  // configured rates (never trusting a client-supplied amount for the priced
  // portion) — this is what backs the Guest Folio auto-charge as well as any
  // manual folio-priced charge from the Cashiering dialog.
  let charge: FolioCharge | null = null;
  if (input.roomTypeId) {
    charge = await computeFolioCharge({
      roomTypeId: input.roomTypeId,
      bedCount: input.bedCount,
      discountType: input.discountType,
      otherDiscountType: input.otherDiscountType,
      otherDiscountRate: input.otherDiscountRate ? Number(input.otherDiscountRate) : null,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: { guest: true },
    });
    if (!reservation) throw new NotFoundError("Reservation not found.");
    if (reservation.status === "CANCELLED") {
      throw new AppError("Cannot post a transaction to a cancelled reservation.", "INVALID_RESERVATION_STATE", 409);
    }

    const sessionId = await getOrCreateCashierSession(tx, actor.userId);
    const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
    const transaction = await tx.cashierTransaction.create({
      data: {
        transactionNo,
        sessionId,
        reservationId: input.reservationId,
        type: input.type,
        amount: charge ? charge.total : input.amount,
        paymentMethod: input.paymentMethod,
        otherPaymentMethod: input.otherPaymentMethod || null,
        reference: input.reference || null,
        processedBy: input.processedBy || null,
        additionalChargeType: input.additionalChargeType ?? null,
        otherChargeType: input.otherChargeType || null,
        userId: actor.userId,
        ...(charge
          ? {
              roomTypeId: input.roomTypeId,
              bedCount: charge.bedCount,
              bedCharge: charge.bedCharge,
              discountType: charge.discountType,
              otherDiscountType: charge.otherDiscountType,
              otherDiscountRate: charge.otherDiscountRate,
              discountAmount: charge.discountAmount,
              subtotal: charge.subtotal,
              vatAmount: charge.vatAmount,
            }
          : {}),
      },
    });

    return { transaction, reservation };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PAYMENT_RECEIVED",
    module: "cashiering",
    recordId: result.transaction.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      transactionNo: result.transaction.transactionNo,
      type: result.transaction.type,
      amount: result.transaction.amount,
      guestName: formatGuestFullName(result.reservation.guest),
    },
  });

  if (charge?.discountType) {
    await recordAudit({
      userId: actor.userId,
      role: actor.role,
      action: "DISCOUNT_APPLIED",
      module: "cashiering",
      recordId: result.transaction.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      newValue: { transactionNo: result.transaction.transactionNo, discountType: charge.discountType, discountAmount: charge.discountAmount },
    });
  }

  return result.transaction;
}

/**
 * "Transact" on an existing CHARGE: settles it in place rather than posting
 * a new visible transaction. The charge keeps its own transactionNo/type/
 * amount forever — this creates a linked PAYMENT row (settlesTransactionId)
 * purely so revenue/balance/audit keep working off the real ledger math
 * everywhere else in the app already relies on, but listTodayTransactions()
 * excludes it from the table, and the charge's own Paid status/receipt are
 * derived from it. Guest/reservation/room/discount/VAT are never touched —
 * they already live on the charge row and this never rewrites them.
 */
export async function payTransaction(
  input: { transactionId: string; amount: number; reference?: string; processedBy: string },
  actor: ActorContext
) {
  const result = await prisma.$transaction(async (tx) => {
    // Locked so two cashiers can't both read the same remaining balance and
    // both post a "full" payment against it.
    await tx.$queryRaw`SELECT id FROM cashier_transactions WHERE id = ${input.transactionId} FOR UPDATE`;

    const charge = await tx.cashierTransaction.findUnique({
      where: { id: input.transactionId },
      include: {
        reservation: { include: { guest: true } },
        settledBy: { select: { amount: true, reversedById: true } },
      },
    });
    if (!charge) throw new NotFoundError("Transaction not found.");
    if (charge.type !== "CHARGE") {
      throw new AppError("Only a charge can be paid through Transact.", "INVALID_TRANSACTION_TYPE", 400);
    }
    if (!charge.reservationId || !charge.reservation) {
      throw new AppError("This charge has no reservation to settle.", "INVALID_TRANSACTION_STATE", 400);
    }

    const alreadyPaid = charge.settledBy.filter((s) => !s.reversedById).reduce((sum, s) => sum + Number(s.amount), 0);
    const remaining = Math.round((Number(charge.amount) - alreadyPaid) * 100) / 100;
    if (remaining <= 0) {
      throw new AppError("Transaction is already fully paid.", "ALREADY_PAID", 409);
    }
    if (input.amount > remaining) {
      throw new AppError(
        `Payment exceeds the remaining balance of ₱${remaining.toFixed(2)}.`,
        "EXCEEDS_BALANCE",
        400
      );
    }

    const sessionId = await getOrCreateCashierSession(tx, actor.userId);
    const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
    const payment = await tx.cashierTransaction.create({
      data: {
        transactionNo,
        sessionId,
        reservationId: charge.reservationId,
        type: "PAYMENT",
        amount: input.amount,
        paymentMethod: charge.paymentMethod,
        otherPaymentMethod: charge.otherPaymentMethod,
        reference: input.reference || null,
        processedBy: input.processedBy,
        userId: actor.userId,
        settlesTransactionId: charge.id,
      },
    });

    // The charge itself is what the Cashiering list/receipt display — once
    // this payment fully settles it, the charge's own Front Desk Officer becomes
    // the cashier who took this payment (it started null: nobody had
    // processed it yet). A partial payment leaves it untouched, since the
    // charge isn't Paid yet.
    const nowPaid = Math.round((alreadyPaid + input.amount) * 100) / 100;
    const fullyPaid = nowPaid >= Number(charge.amount) - 0.001;
    const settledCharge = fullyPaid
      ? await tx.cashierTransaction.update({
          where: { id: charge.id },
          data: { processedBy: input.processedBy },
          include: {
            reservation: { include: { guest: true } },
            settledBy: { select: { amount: true, reversedById: true } },
          },
        })
      : charge;

    return { charge: settledCharge, payment };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PAYMENT_RECEIVED",
    module: "cashiering",
    recordId: result.charge.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      transactionNo: result.charge.transactionNo,
      amount: input.amount,
      guestName: formatGuestFullName(result.charge.reservation!.guest),
    },
  });

  return result.charge;
}

export async function issueRefund(input: IssueRefundInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    // Lock the original payment row for the duration of this transaction so two
    // concurrent refund requests against the same payment can't both read
    // reversedById as null before either commits — without this, the second
    // writer's update would silently clobber the first, double-refunding it.
    await tx.$queryRaw`SELECT id FROM cashier_transactions WHERE id = ${input.originalTransactionId} FOR UPDATE`;

    const original = await tx.cashierTransaction.findUnique({
      where: { id: input.originalTransactionId },
      include: { reservation: { include: { guest: true } } },
    });
    if (!original) throw new NotFoundError("Original transaction not found.");
    if (original.type !== "PAYMENT") {
      throw new AppError("Only payments can be refunded.", "INVALID_TRANSACTION_TYPE", 400);
    }
    if (original.reversedById) {
      throw new AppError("This payment has already been refunded.", "ALREADY_REFUNDED", 409);
    }
    if (input.amount > Number(original.amount)) {
      throw new AppError("Refund amount cannot exceed the original payment.", "REFUND_EXCEEDS_ORIGINAL", 400);
    }

    const sessionId = await getOrCreateCashierSession(tx, actor.userId);
    const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
    const refund = await tx.cashierTransaction.create({
      data: {
        transactionNo,
        sessionId,
        reservationId: original.reservationId,
        type: "REFUND",
        amount: input.amount,
        paymentMethod: original.paymentMethod,
        otherPaymentMethod: original.otherPaymentMethod,
        reference: input.reference || `Refund of ${original.transactionNo}`,
        processedBy: input.processedBy,
        userId: actor.userId,
      },
    });
    await tx.cashierTransaction.update({ where: { id: original.id }, data: { reversedById: refund.id } });

    return { refund, original };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "REFUND_CREATED",
    module: "cashiering",
    recordId: result.refund.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { transactionNo: result.original.transactionNo },
    newValue: {
      transactionNo: result.refund.transactionNo,
      amount: input.amount,
      guestName: result.original.reservation
        ? formatGuestFullName(result.original.reservation.guest)
        : undefined,
    },
  });

  return result.refund;
}

// ---------------------------------------------------------------------------
// Receipts — a receipt is any PAYMENT or REFUND transaction. There is no
// separate receipts table; PAYMENT/REFUND rows on CashierTransaction *are*
// the receipt records, with transactionNo serving as the receipt number.
// ---------------------------------------------------------------------------

const receiptInclude = {
  reservation: {
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true, isSmoking: true, roomType: { select: { name: true, baseRate: true } } } },
    },
  },
  clubMembership: {
    include: {
      guest: { select: { firstName: true, middleName: true, lastName: true } },
    },
  },
  user: { select: { firstName: true, lastName: true } },
  roomType: { select: { name: true } },
} satisfies Prisma.CashierTransactionInclude;

type ReceiptTransaction = Prisma.CashierTransactionGetPayload<{ include: typeof receiptInclude }>;

function receiptStatus(t: { type: string; reversedById: string | null }): ReceiptStatus {
  if (t.type === "REFUND") return "REFUND_ISSUED";
  return t.reversedById ? "REFUNDED" : "PAID";
}

function toReceiptRow(t: ReceiptTransaction) {
  return {
    id: t.id,
    receiptNumber: t.transactionNo,
    type: t.type,
    status: receiptStatus(t),
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    otherPaymentMethod: t.otherPaymentMethod,
    description: t.reference,
    paymentDate: t.createdAt,
    guestName: t.reservation
      ? formatGuestFullName(t.reservation.guest)
      : t.clubMembership
        ? formatGuestFullName(t.clubMembership.guest)
        : null,
    reservationNo: t.reservation?.reservationNo ?? null,
    // Present only for the one-time Club Membership fee — lets the receipt
    // page render "CLUB MEMBERSHIP RECEIPT" with a Membership ID instead of
    // the standard Guest/Reservation/Room layout.
    membership: t.clubMembership ? { membershipNo: t.clubMembership.membershipNo } : null,
    processedBy: t.processedBy,
    // Folio pricing breakdown — null for plain (non-room) transactions.
    roomNumber: t.reservation?.room?.number ?? null,
    roomTypeName: t.roomType?.name ?? t.reservation?.room?.roomType?.name ?? null,
    isSmoking: t.reservation?.room?.isSmoking ?? null,
    subtotal: t.subtotal,
    bedCount: t.bedCount,
    bedCharge: t.bedCharge,
    discountType: t.discountType,
    otherDiscountType: t.otherDiscountType,
    otherDiscountRate: t.otherDiscountRate,
    discountAmount: t.discountAmount,
    vatAmount: t.vatAmount,
  };
}

function receiptStatusWhere(status?: ReceiptStatus): Prisma.CashierTransactionWhereInput {
  if (status === "PAID") return { type: "PAYMENT", reversedById: null };
  if (status === "REFUNDED") return { type: "PAYMENT", reversedById: { not: null } };
  if (status === "REFUND_ISSUED") return { type: "REFUND" };
  return {};
}

export type ReceiptListFilters = {
  status?: ReceiptStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
};

export async function listReceipts(pagination: PaginationInput, filters: ReceiptListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.CashierTransactionWhereInput = {
    type: { in: ["PAYMENT", "REFUND"] },
    ...receiptStatusWhere(filters.status),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: startOfDay(new Date(filters.dateFrom)) } : {}),
            ...(filters.dateTo ? { lte: endOfDay(new Date(filters.dateTo)) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { transactionNo: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
            { reservation: { reservationNo: { contains: search, mode: "insensitive" } } },
            { reservation: { guest: { firstName: { contains: search, mode: "insensitive" } } } },
            { reservation: { guest: { lastName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const sortableFields = new Set(["createdAt", "transactionNo", "amount"]);
  const orderBy: Prisma.CashierTransactionOrderByWithRelationInput =
    sortBy && sortableFields.has(sortBy) ? { [sortBy]: sortDir } : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    prisma.cashierTransaction.count({ where }),
    prisma.cashierTransaction.findMany({
      where,
      include: receiptInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { rows: rows.map(toReceiptRow), meta: paginationMeta(total, { page, pageSize }) };
}

export async function getReceiptKpis() {
  const [totalReceipts, collected, refunded] = await Promise.all([
    prisma.cashierTransaction.count({ where: { type: { in: ["PAYMENT", "REFUND"] } } }),
    prisma.cashierTransaction.aggregate({ where: { type: "PAYMENT" }, _sum: { amount: true } }),
    prisma.cashierTransaction.aggregate({ where: { type: "REFUND" }, _sum: { amount: true } }),
  ]);

  const totalCollected = Number(collected._sum.amount ?? 0);
  const totalRefunded = Number(refunded._sum.amount ?? 0);

  return { totalReceipts, totalCollected, totalRefunded, netCollected: totalCollected - totalRefunded };
}

export async function getReceiptById(id: string) {
  const transaction = await prisma.cashierTransaction.findUnique({
    where: { id },
    include: { ...receiptInclude, settledBy: { select: { amount: true, reversedById: true, createdAt: true } } },
  });
  if (!transaction) throw new NotFoundError("Receipt not found.");

  // A CHARGE row never gets its own PAYMENT/REFUND-only receipt eligibility —
  // unless "Transact" has fully settled it in place (see payTransaction()),
  // in which case the receipt is the charge itself, not a separate row.
  const settledAmount = transaction.settledBy
    .filter((s) => !s.reversedById)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const isSettledCharge = transaction.type === "CHARGE" && settledAmount >= Number(transaction.amount);
  if (transaction.type !== "PAYMENT" && transaction.type !== "REFUND" && !isSettledCharge) {
    throw new NotFoundError("Receipt not found.");
  }

  const [refundOf, refundedBy] = await Promise.all([
    transaction.type === "REFUND"
      ? prisma.cashierTransaction.findFirst({
          where: { reversedById: transaction.id },
          select: { transactionNo: true },
        })
      : null,
    transaction.reversedById
      ? prisma.cashierTransaction.findUnique({
          where: { id: transaction.reversedById },
          select: { transactionNo: true, createdAt: true },
        })
      : null,
  ]);

  const row = toReceiptRow(transaction);

  // A charge fully settled in place by "Transact" — the receipt is the
  // charge's own transactionNo (never the linked internal payment's), with
  // the payment date/status pulled from when it was actually paid.
  if (isSettledCharge) {
    const lastSettlement = transaction.settledBy
      .filter((s) => !s.reversedById)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    Object.assign(row, { type: "PAYMENT" as const, paymentDate: lastSettlement?.createdAt ?? row.paymentDate });
  }

  // A PAYMENT settling a folio-priced CHARGE doesn't itself carry the pricing
  // breakdown (only the CHARGE does) — pull it from the originating charge so
  // the printed receipt still itemizes Room/Bed/Discount/VAT, not just the
  // lump sum paid.
  if (row.subtotal === null && transaction.reservationId) {
    const charge = await prisma.cashierTransaction.findFirst({
      where: { reservationId: transaction.reservationId, type: "CHARGE", subtotal: { not: null } },
      orderBy: { createdAt: "desc" },
      include: receiptInclude,
    });
    if (charge) {
      const chargeRow = toReceiptRow(charge);
      Object.assign(row, {
        roomNumber: chargeRow.roomNumber,
        roomTypeName: chargeRow.roomTypeName,
        isSmoking: chargeRow.isSmoking,
        subtotal: chargeRow.subtotal,
        bedCount: chargeRow.bedCount,
        bedCharge: chargeRow.bedCharge,
        discountType: chargeRow.discountType,
        otherDiscountType: chargeRow.otherDiscountType,
        otherDiscountRate: chargeRow.otherDiscountRate,
        discountAmount: chargeRow.discountAmount,
        vatAmount: chargeRow.vatAmount,
      });
    }
  }

  return {
    ...row,
    refundOfReceiptNumber: refundOf?.transactionNo ?? null,
    refundedByReceiptNumber: refundedBy?.transactionNo ?? null,
    refundedAt: refundedBy?.createdAt ?? null,
  };
}
