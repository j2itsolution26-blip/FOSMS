import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { REPORT_TYPES, previewReportCsv, type ReportType } from "@/services/report.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.REPORTS_GENERATE);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") as ReportType | null;
  if (!type || !REPORT_TYPES.some((t) => t.value === type)) {
    return apiError("Unknown report type.", "INVALID_REPORT_TYPE", 400);
  }

  const csv = await previewReportCsv(
    type,
    {
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      competencyId: searchParams.get("competencyId") ?? undefined,
      batchId: searchParams.get("batchId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      assessorId: searchParams.get("assessorId") ?? undefined,
    },
    { userId: auth.user.id, role: auth.user.roles[0] ?? null }
  );

  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
