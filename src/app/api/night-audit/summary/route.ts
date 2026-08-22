import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getNightAuditWorkbook } from "@/services/night-audit.service";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "NIGHT_AUDIT_OPENED":
      return "Night audit opened for today.";
    case "NIGHT_AUDIT_FINALIZED":
      return `Night audit finalized — ${v.transactionsReviewed ?? 0} transactions reviewed, revenue ₱${Number(v.revenue ?? 0).toFixed(2)}.`;
    default:
      return action;
  }
}

export async function GET() {
  const auth = await authorize(PERMISSIONS.NIGHT_AUDIT_VIEW);
  if (auth.error) return auth.error;

  const [workbook, activityLogs] = await Promise.all([
    getNightAuditWorkbook(),
    getRecentModuleActivity("night-audit", 8),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess({ ...workbook, activity });
}
