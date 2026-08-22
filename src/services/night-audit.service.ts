import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

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

function reservationBalance(transactions: { type: string; amount: unknown }[]) {
  return transactions.reduce((sum, t) => {
    const amount = Number(t.amount);
    if (t.type === "CHARGE") return sum + amount;
    if (t.type === "PAYMENT" || t.type === "DISCOUNT" || t.type === "REFUND") return sum - amount;
    return sum;
  }, 0);
}

export async function getCurrentAudit() {
  const today = startOfDay(new Date());
  return prisma.nightAudit.findUnique({ where: { auditDate: today } });
}

export async function getNightAuditWorkbook() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [audit, transactions, arrivals, departures, roomStatusGroups, openSessions, checkedInReservations] =
    await Promise.all([
      prisma.nightAudit.findUnique({
        where: { auditDate: todayStart },
        include: {
          openedBy: { select: { firstName: true, lastName: true } },
          finalizedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.cashierTransaction.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        orderBy: { createdAt: "desc" },
        include: {
          reservation: { select: { reservationNo: true, guest: { select: { firstName: true, lastName: true } } } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.reservation.findMany({
        where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } },
        orderBy: { arrivalDate: "asc" },
      }),
      prisma.reservation.findMany({
        where: { departureDate: { gte: todayStart, lte: todayEnd }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } },
        include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } },
        orderBy: { departureDate: "asc" },
      }),
      prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.cashierSession.findMany({
        where: { status: "OPEN" },
        include: { cashier: { select: { firstName: true, lastName: true } } },
      }),
      prisma.reservation.findMany({
        where: { status: "CHECKED_IN" },
        select: {
          id: true,
          reservationNo: true,
          guest: { select: { firstName: true, lastName: true } },
          transactions: { select: { type: true, amount: true } },
        },
      }),
    ]);

  const outstandingBalances = checkedInReservations
    .map((r) => ({
      id: r.id,
      reservationNo: r.reservationNo,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      balance: reservationBalance(r.transactions),
    }))
    .filter((r) => r.balance > 0);

  const revenue = transactions.reduce((sum, t) => {
    if (t.type === "PAYMENT") return sum + Number(t.amount);
    if (t.type === "REFUND") return sum - Number(t.amount);
    return sum;
  }, 0);

  return {
    audit,
    transactions,
    arrivals,
    departures,
    roomStatus: Object.fromEntries(roomStatusGroups.map((g) => [g.status, g._count._all])),
    openSessions,
    outstandingBalances,
    revenue,
  };
}

export async function openNightAudit(actor: ActorContext) {
  const today = startOfDay(new Date());
  const existing = await prisma.nightAudit.findUnique({ where: { auditDate: today } });
  if (existing) {
    throw new AppError("Tonight's audit has already been opened.", "AUDIT_ALREADY_OPEN", 409);
  }

  const audit = await prisma.nightAudit.create({
    data: { auditDate: today, status: "OPEN", openedById: actor.userId },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "NIGHT_AUDIT_OPENED",
    module: "night-audit",
    recordId: audit.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return audit;
}

export async function finalizeNightAudit(actor: ActorContext) {
  const today = startOfDay(new Date());
  const audit = await prisma.nightAudit.findUnique({ where: { auditDate: today } });
  if (!audit) {
    throw new AppError("Open the night audit before finalizing it.", "AUDIT_NOT_OPEN", 409);
  }
  if (audit.status === "FINALIZED") {
    throw new AppError("Tonight's audit has already been finalized.", "AUDIT_ALREADY_FINALIZED", 409);
  }

  const openSessionCount = await prisma.cashierSession.count({ where: { status: "OPEN" } });
  if (openSessionCount > 0) {
    throw new AppError(
      "Close all open cashier sessions before finalizing the night audit.",
      "OPEN_CASHIER_SESSIONS",
      409
    );
  }

  const workbook = await getNightAuditWorkbook();
  const summary = {
    transactionsReviewed: workbook.transactions.length,
    revenue: workbook.revenue,
    arrivals: workbook.arrivals.length,
    departures: workbook.departures.length,
    roomStatus: workbook.roomStatus,
    outstandingBalanceCount: workbook.outstandingBalances.length,
    outstandingBalanceTotal: workbook.outstandingBalances.reduce((sum, r) => sum + r.balance, 0),
  };

  const updated = await prisma.nightAudit.update({
    where: { id: audit.id },
    data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: actor.userId, summary },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "NIGHT_AUDIT_FINALIZED",
    module: "night-audit",
    recordId: updated.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: summary,
  });

  return updated;
}
