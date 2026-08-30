import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { REPORT_TYPES } from "@/services/report.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.REPORTS_VIEW);
  if (auth.error) return auth.error;

  const canViewFinancial = hasPermission(auth.user, PERMISSIONS.CASHIERING_VIEW);
  const reportTypes = canViewFinancial ? REPORT_TYPES : REPORT_TYPES.filter((t) => t.category !== "Financial");

  return apiSuccess({ reportTypes });
}
