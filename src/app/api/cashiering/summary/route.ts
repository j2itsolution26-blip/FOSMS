import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getCashieringKpis, getMyOpenSession, listTodayTransactions } from "@/services/cashiering.service";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "PAYMENT_RECEIVED":
      return `${v.type ?? "Transaction"} ${v.transactionNo ?? ""}: ₱${Number(v.amount ?? 0).toFixed(2)} — ${v.guestName ?? ""}`;
    case "REFUND_CREATED":
      return `Refund ${v.transactionNo ?? ""}: ₱${Number(v.amount ?? 0).toFixed(2)} — ${v.guestName ?? ""}`;
    case "DISCOUNT_APPLIED":
      return `Discount applied to ${v.transactionNo ?? ""}: ${v.discountType ?? ""} -₱${Number(v.discountAmount ?? 0).toFixed(2)}`;
    case "CASHIER_OPENED":
      return `Cashier session opened (₱${Number(v.openingCash ?? 0).toFixed(2)})`;
    case "CASHIER_CLOSED":
      return `Cashier session closed (variance ₱${Number(v.variance ?? 0).toFixed(2)})`;
    default:
      return action;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CASHIERING_VIEW);
  if (auth.error) return auth.error;

  const search = req.nextUrl.searchParams.get("search") ?? "";

  const [kpis, transactions, activityLogs, mySession] = await Promise.all([
    getCashieringKpis(),
    listTodayTransactions(search),
    getRecentModuleActivity("cashiering", 8),
    getMyOpenSession(auth.user.id),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess({ kpis, transactions, activity, mySessionOpen: !!mySession });
}
