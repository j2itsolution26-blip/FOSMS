import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getConciergeKpis, listServiceRequests } from "@/services/concierge.service";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "SERVICE_REQUEST_CREATED":
      return `New request ${v.requestNo ?? ""}: ${v.description ?? ""}`;
    case "SERVICE_REQUEST_ASSIGNED":
      return `${v.requestNo ?? ""} assigned to ${v.assignedTo ?? ""}`;
    case "SERVICE_REQUEST_COMPLETED":
      return `Request completed`;
    default:
      return action;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CONCIERGE_VIEW);
  if (auth.error) return auth.error;

  const search = req.nextUrl.searchParams.get("search") ?? "";

  const [kpis, requests, activityLogs] = await Promise.all([
    getConciergeKpis(),
    listServiceRequests(search),
    getRecentModuleActivity("concierge", 8),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess({ kpis, requests, activity });
}
