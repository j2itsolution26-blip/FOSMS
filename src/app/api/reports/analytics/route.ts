import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import {
  getFrontOfficeSnapshot,
  getRoomOccupancyReport,
  getReservationStatusReport,
  getRevenueTransactionsTrend,
  getPaymentMethodReport,
  getFinancialSummaryReport,
  getDiscountReport,
  getVatReport,
  resolveDateRange,
} from "@/services/report.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.REPORTS_VIEW);
  if (auth.error) return auth.error;

  const canViewFinancial = hasPermission(auth.user, PERMISSIONS.CASHIERING_VIEW);

  const params = req.nextUrl.searchParams;
  const range = resolveDateRange(params.get("range") ?? "today", params.get("from") ?? undefined, params.get("to") ?? undefined);

  const [snapshot, roomOccupancy, reservationStatus, revenueTrend, paymentMethods, financialSummary, discounts, vat] =
    await Promise.all([
      getFrontOfficeSnapshot(),
      getRoomOccupancyReport(),
      getReservationStatusReport(range),
      canViewFinancial ? getRevenueTransactionsTrend(range) : Promise.resolve(null),
      canViewFinancial ? getPaymentMethodReport(range) : Promise.resolve(null),
      canViewFinancial ? getFinancialSummaryReport(range) : Promise.resolve(null),
      canViewFinancial ? getDiscountReport(range) : Promise.resolve(null),
      canViewFinancial ? getVatReport(range) : Promise.resolve(null),
    ]);

  // Financial figures are stripped from the snapshot too — a user without
  // cashiering:view must never receive them, not just have them hidden in the UI.
  const nonFinancialSnapshot = {
    activeReservations: snapshot.activeReservations,
    roomOccupancyRate: snapshot.roomOccupancyRate,
    occupiedRooms: snapshot.occupiedRooms,
    availableRooms: snapshot.availableRooms,
    totalRooms: snapshot.totalRooms,
    checkInsToday: snapshot.checkInsToday,
    checkOutsToday: snapshot.checkOutsToday,
    activeGuests: snapshot.activeGuests,
  };

  return apiSuccess({
    canViewFinancial,
    snapshot: canViewFinancial ? snapshot : nonFinancialSnapshot,
    roomOccupancy,
    reservationStatus,
    revenueTrend,
    paymentMethods,
    financialSummary,
    discounts,
    vat,
  });
}
