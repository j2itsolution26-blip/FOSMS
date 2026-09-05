import "server-only";
import { prisma } from "@/lib/prisma";
import { getRoomOccupancySummary } from "@/services/room.service";
import { getCashieringKpis, getOutstandingBalanceTotal } from "@/services/cashiering.service";
import { getFrontOfficeKpis } from "@/services/front-office.service";
import { toCsv } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";
import { formatGuestFullName, formatPaymentMethod } from "@/lib/formatters";
import { isAvailableCategory, isOccupiedCategory, roomStatusLabel } from "@/config/room-status";
import type { RoomStatus } from "@prisma/client";

export const REPORT_TYPES = [
  { value: "reservations", label: "Reservations", category: "Operational" },
  { value: "room-occupancy", label: "Room Occupancy", category: "Operational" },
  { value: "cashiering-transactions", label: "Cashiering Transactions", category: "Financial" },
  { value: "receipts", label: "Receipts (Payments & Refunds)", category: "Financial" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

const RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;
const TRANSACTION_TYPES = ["CHARGE", "PAYMENT", "REFUND", "DISCOUNT"] as const;

type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export async function previewReportCsv(type: ReportType, filters: ReportFilters, actor: { userId: string; role: string | null }) {
  const csv = await buildReportCsv(type, filters);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "REPORT_GENERATED",
    module: "reports",
    newValue: { type, filters },
  });

  return csv;
}

export async function exportReportCsv(type: ReportType, filters: ReportFilters, actor: { userId: string; role: string | null }) {
  const csv = await buildReportCsv(type, filters);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "REPORT_EXPORTED",
    module: "reports",
    newValue: { type, filters },
  });

  return csv;
}

async function buildReportCsv(type: ReportType, filters: ReportFilters): Promise<string> {
  const dateRange =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        }
      : undefined;

  switch (type) {
    case "room-occupancy": {
      const rooms = await prisma.room.findMany({ include: { roomType: true }, orderBy: [{ floor: "asc" }, { number: "asc" }] });
      return toCsv(
        ["Room", "Floor", "Type", "Status"],
        rooms.map((r) => [r.number, String(r.floor), r.roomType.name, roomStatusLabel(r.status)])
      );
    }

    case "cashiering-transactions": {
      const rows = await prisma.cashierTransaction.findMany({
        where: {
          ...(dateRange ? { createdAt: dateRange } : {}),
          ...(filters.status && TRANSACTION_TYPES.includes(filters.status as (typeof TRANSACTION_TYPES)[number])
            ? { type: filters.status as (typeof TRANSACTION_TYPES)[number] }
            : {}),
        },
        include: { reservation: { include: { guest: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      return toCsv(
        ["Transaction #", "Type", "Guest", "Reservation #", "Amount", "Payment Method", "Discount Type", "VAT", "Date"],
        rows.map((r) => [
          r.transactionNo,
          r.type,
          r.reservation ? formatGuestFullName(r.reservation.guest) : "—",
          r.reservation?.reservationNo ?? "—",
          Number(r.amount).toFixed(2),
          formatPaymentMethod(r.paymentMethod, r.otherPaymentMethod) ?? "—",
          r.discountType ?? "—",
          r.vatAmount ? Number(r.vatAmount).toFixed(2) : "—",
          r.createdAt.toISOString().slice(0, 10),
        ])
      );
    }

    case "receipts": {
      const rows = await prisma.cashierTransaction.findMany({
        where: {
          type: { in: ["PAYMENT", "REFUND"] },
          ...(dateRange ? { createdAt: dateRange } : {}),
        },
        include: { reservation: { include: { guest: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      return toCsv(
        ["Receipt #", "Type", "Guest", "Reservation #", "Amount", "Payment Method", "Date"],
        rows.map((r) => [
          r.transactionNo,
          r.type,
          r.reservation ? formatGuestFullName(r.reservation.guest) : "—",
          r.reservation?.reservationNo ?? "—",
          Number(r.amount).toFixed(2),
          formatPaymentMethod(r.paymentMethod, r.otherPaymentMethod) ?? "—",
          r.createdAt.toISOString().slice(0, 10),
        ])
      );
    }

    case "reservations":
    default: {
      const rows = await prisma.reservation.findMany({
        where: {
          ...(dateRange ? { createdAt: dateRange } : {}),
          ...(filters.status && RESERVATION_STATUSES.includes(filters.status as (typeof RESERVATION_STATUSES)[number])
            ? { status: filters.status as (typeof RESERVATION_STATUSES)[number] }
            : {}),
        },
        include: { guest: true, room: { include: { roomType: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      return toCsv(
        ["Reservation #", "Guest", "Room", "Room Type", "Arrival", "Departure", "Status", "Source"],
        rows.map((r) => [
          r.reservationNo,
          formatGuestFullName(r.guest),
          r.room.number,
          r.room.roomType.name,
          r.arrivalDate.toISOString().slice(0, 10),
          r.departureDate.toISOString().slice(0, 10),
          r.status,
          r.source,
        ])
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Front Office Reports & Analytics — every figure below is a real aggregate
// over Reservation/Room/CashierTransaction records, never estimated. Financial
// figures (revenue, payment methods, discounts, VAT, financial summary) are
// gated by PERMISSIONS.CASHIERING_VIEW at the API route, not here — this
// service always computes the full picture; the route decides what to return.
// ---------------------------------------------------------------------------

export type DateRange = { from: Date; to: Date };

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

/** Resolves a date-filter preset (or explicit custom bounds) into a concrete [from, to] range. */
export function resolveDateRange(preset: string, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  switch (preset) {
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay()); // Sunday-start week
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "custom": {
      if (customFrom && customTo) {
        return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
      }
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    case "today":
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

/**
 * Always-live operational snapshot — not affected by the date filter, since
 * "today's revenue," "room occupancy," and "outstanding balance" are current
 * states, not activity-over-a-range figures. Consolidated into one set of
 * queries so the dashboard's 8 summary cards + Front Office Activity panel
 * cost a single request, not one per card.
 */
export async function getFrontOfficeSnapshot() {
  const [cashieringKpis, frontOfficeKpis, roomSummary, outstandingBalance, activeReservations] = await Promise.all([
    getCashieringKpis(),
    getFrontOfficeKpis(),
    getRoomOccupancySummary(),
    getOutstandingBalanceTotal(),
    prisma.reservation.count({ where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } } }),
  ]);

  const occupiedCount = Object.entries(roomSummary.byStatus).reduce(
    (sum, [status, count]) => (isOccupiedCategory(status as RoomStatus) ? sum + count : sum),
    0
  );
  const availableCount = Object.entries(roomSummary.byStatus).reduce(
    (sum, [status, count]) => (isAvailableCategory(status as RoomStatus) ? sum + count : sum),
    0
  );
  const occupancyRate = roomSummary.total ? Math.round((occupiedCount / roomSummary.total) * 100) : 0;

  return {
    todaysRevenue: cashieringKpis.todaysRevenue,
    todaysTransactions: cashieringKpis.todaysTransactions,
    activeReservations,
    roomOccupancyRate: occupancyRate,
    occupiedRooms: occupiedCount,
    availableRooms: availableCount,
    totalRooms: roomSummary.total,
    checkInsToday: frontOfficeKpis.todaysCheckIns,
    checkOutsToday: frontOfficeKpis.todaysCheckOuts,
    activeGuests: frontOfficeKpis.inHouseGuests,
    outstandingBalance,
  };
}

/** Live room-status breakdown — reused as-is from Room Management; never date-filtered (a room has one current status, not a history-over-range). */
export async function getRoomOccupancyReport() {
  return getRoomOccupancySummary();
}

/** Reservation-status breakdown over the selected range, by when each reservation was created. */
export async function getReservationStatusReport(range: DateRange) {
  const grouped = await prisma.reservation.groupBy({
    by: ["status"],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  return RESERVATION_STATUSES.map((status) => ({ status, count: byStatus[status] ?? 0 })).filter((s) => s.count > 0);
}

/**
 * Daily revenue (payments − refunds) and transaction-count series over the
 * selected range. Buckets by real Date-object day boundaries (local time),
 * not by converting to toISOString() date-strings — that conversion shifts
 * to UTC and silently drops/misplaces rows in any timezone ahead of UTC.
 */
export async function getRevenueTransactionsTrend(range: DateRange) {
  const rows = await prisma.cashierTransaction.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: { type: true, amount: true, createdAt: true },
  });

  const days: { start: Date; end: Date; date: string; label: string; revenue: number; transactionCount: number }[] = [];
  const cursor = startOfDay(range.from);
  while (cursor <= range.to) {
    const start = new Date(cursor);
    const end = endOfDay(cursor);
    days.push({
      start,
      end,
      date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: 0,
      transactionCount: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of rows) {
    const bucket = days.find((d) => row.createdAt >= d.start && row.createdAt <= d.end);
    if (!bucket) continue;
    bucket.transactionCount += 1;
    if (row.type === "PAYMENT") bucket.revenue += Number(row.amount);
    if (row.type === "REFUND") bucket.revenue -= Number(row.amount);
  }

  return days.map((d) => ({
    date: d.date,
    label: d.label,
    revenue: Math.round(d.revenue * 100) / 100,
    transactionCount: d.transactionCount,
  }));
}

/** Payment-method breakdown (count + total) over the selected range — actual PAYMENT transactions only. */
export async function getPaymentMethodReport(range: DateRange) {
  const grouped = await prisma.cashierTransaction.groupBy({
    by: ["paymentMethod"],
    where: { createdAt: { gte: range.from, lte: range.to }, type: "PAYMENT" },
    _sum: { amount: true },
    _count: { _all: true },
  });

  return grouped
    .filter((g) => g.paymentMethod)
    .map((g) => ({ method: g.paymentMethod as string, count: g._count._all, amount: Number(g._sum.amount ?? 0) }));
}

/** Gross charges, discounts, VAT, net revenue, payments, refunds — all authoritative Cashiering aggregates. Outstanding balance is the same live figure as the snapshot (a point-in-time state, not a range total). */
export async function getFinancialSummaryReport(range: DateRange) {
  const where = { createdAt: { gte: range.from, lte: range.to } };

  const [chargeAgg, paymentAgg, refundAgg, outstandingBalance] = await Promise.all([
    prisma.cashierTransaction.aggregate({
      where: { ...where, type: "CHARGE" },
      _sum: { subtotal: true, discountAmount: true, vatAmount: true, amount: true },
    }),
    prisma.cashierTransaction.aggregate({ where: { ...where, type: "PAYMENT" }, _sum: { amount: true } }),
    prisma.cashierTransaction.aggregate({ where: { ...where, type: "REFUND" }, _sum: { amount: true } }),
    getOutstandingBalanceTotal(),
  ]);

  return {
    grossCharges: Number(chargeAgg._sum.subtotal ?? 0),
    discounts: Number(chargeAgg._sum.discountAmount ?? 0),
    vat: Number(chargeAgg._sum.vatAmount ?? 0),
    netRevenue: Number(chargeAgg._sum.amount ?? 0),
    paymentsReceived: Number(paymentAgg._sum.amount ?? 0),
    refunds: Number(refundAgg._sum.amount ?? 0),
    outstandingBalance,
  };
}

/** Discount usage by configured discount type over the selected range — empty array means no discounts were applied (render "No discount data available"), never invented. */
export async function getDiscountReport(range: DateRange) {
  const grouped = await prisma.cashierTransaction.groupBy({
    by: ["discountType"],
    where: { createdAt: { gte: range.from, lte: range.to }, type: "CHARGE", discountType: { not: null } },
    _sum: { discountAmount: true },
    _count: { _all: true },
  });

  return grouped
    .filter((g) => g.discountType)
    .map((g) => ({
      discountType: g.discountType as string,
      transactionCount: g._count._all,
      totalAmount: Number(g._sum.discountAmount ?? 0),
    }));
}

/** VAT actually recorded on charges over the selected range (the same rate/amount Cashiering computed at charge time — never recalculated here). */
export async function getVatReport(range: DateRange) {
  const agg = await prisma.cashierTransaction.aggregate({
    where: { createdAt: { gte: range.from, lte: range.to }, type: "CHARGE", vatAmount: { gt: 0 } },
    _sum: { vatAmount: true },
    _count: { _all: true },
  });

  return { vatCollected: Number(agg._sum.vatAmount ?? 0), vatTransactionCount: agg._count._all };
}
