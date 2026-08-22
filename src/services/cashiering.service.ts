import "server-only";
import type { PaymentMethod, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
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

function reservationBalance(transactions: { type: string; amount: Prisma.Decimal | number }[]) {
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

  const [todaysTransactions, todaysPayments, todaysRefunds, openCashiers, checkedInReservations] = await Promise.all([
    prisma.cashierTransaction.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.cashierTransaction.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.cashierTransaction.aggregate({
      where: { type: "REFUND", createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.cashierSession.count({ where: { status: "OPEN" } }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN" },
      select: { id: true, transactions: { select: { type: true, amount: true } } },
    }),
  ]);

  const todaysRevenue = Number(todaysPayments._sum.amount ?? 0) - Number(todaysRefunds._sum.amount ?? 0);
  const pendingPayments = checkedInReservations.filter((r) => reservationBalance(r.transactions) > 0).length;

  return { todaysTransactions, todaysRevenue, openCashiers, pendingPayments };
}

export async function listTodayTransactions(search = "") {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const searchLower = search.trim();

  return prisma.cashierTransaction.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
      ...(searchLower
        ? {
            OR: [
              { transactionNo: { contains: searchLower, mode: "insensitive" } },
              { reservation: { reservationNo: { contains: searchLower, mode: "insensitive" } } },
              { reservation: { guest: { firstName: { contains: searchLower, mode: "insensitive" } } } },
              { reservation: { guest: { lastName: { contains: searchLower, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reservation: { include: { guest: { select: { firstName: true, lastName: true } } } },
      user: { select: { firstName: true, lastName: true } },
    },
    take: 200,
  });
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
  const session = await getMyOpenSession(actor.userId);
  if (!session) {
    throw new AppError("Open a cashier session before recording transactions.", "NO_OPEN_SESSION", 409);
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

    const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
    const transaction = await tx.cashierTransaction.create({
      data: {
        transactionNo,
        sessionId: session.id,
        reservationId: input.reservationId,
        type: input.type,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        reference: input.reference || null,
        userId: actor.userId,
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
      amount: input.amount,
      guestName: `${result.reservation.guest.firstName} ${result.reservation.guest.lastName}`,
    },
  });

  return result.transaction;
}

export async function issueRefund(input: IssueRefundInput, actor: ActorContext) {
  const session = await getMyOpenSession(actor.userId);
  if (!session) {
    throw new AppError("Open a cashier session before issuing refunds.", "NO_OPEN_SESSION", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
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

    const transactionNo = await nextNumber(tx, "cashier-transaction", "TXN");
    const refund = await tx.cashierTransaction.create({
      data: {
        transactionNo,
        sessionId: session.id,
        reservationId: original.reservationId,
        type: "REFUND",
        amount: input.amount,
        paymentMethod: original.paymentMethod,
        reference: input.reference || `Refund of ${original.transactionNo}`,
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
        ? `${result.original.reservation.guest.firstName} ${result.original.reservation.guest.lastName}`
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
  reservation: { include: { guest: { select: { firstName: true, lastName: true } } } },
  user: { select: { firstName: true, lastName: true } },
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
    description: t.reference,
    paymentDate: t.createdAt,
    guestName: t.reservation ? `${t.reservation.guest.firstName} ${t.reservation.guest.lastName}` : null,
    reservationNo: t.reservation?.reservationNo ?? null,
    createdBy: `${t.user.firstName} ${t.user.lastName}`,
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
    include: receiptInclude,
  });
  if (!transaction || (transaction.type !== "PAYMENT" && transaction.type !== "REFUND")) {
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

  return {
    ...toReceiptRow(transaction),
    refundOfReceiptNumber: refundOf?.transactionNo ?? null,
    refundedByReceiptNumber: refundedBy?.transactionNo ?? null,
    refundedAt: refundedBy?.createdAt ?? null,
  };
}
