import type { NextRequest } from "next/server";

import { apiError, apiForbidden } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { REPORT_TYPES, previewReportCsv, type ReportType } from "@/services/report.service";

const FINANCIAL_REPORT_TYPES: ReportType[] = ["cashiering-transactions", "receipts"];

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.REPORTS_GENERATE);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") as ReportType | null;
  if (!type || !REPORT_TYPES.some((t) => t.value === type)) {
    return apiError("Unknown report type.", "INVALID_REPORT_TYPE", 400);
  }
  if (FINANCIAL_REPORT_TYPES.includes(type) && !hasPermission(auth.user, PERMISSIONS.CASHIERING_VIEW)) {
    return apiForbidden();
  }

  const csv = await previewReportCsv(
    type,
    {
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    },
    { userId: auth.user.id, role: auth.user.roles[0] ?? null }
  );

  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
