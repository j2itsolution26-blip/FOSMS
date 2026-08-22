import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getClubReceptionKpis, listTodayReceptions } from "@/services/club-reception.service";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "CLUB_REGISTRATION":
      return `${v.isVisitor ? "Visitor" : "Member"} registered: ${v.guestName ?? ""}`;
    case "CLUB_CHECK_OUT":
      return `Checked out: ${v.guestName ?? ""}`;
    default:
      return action;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (auth.error) return auth.error;

  const search = req.nextUrl.searchParams.get("search") ?? "";

  const [kpis, records, activityLogs] = await Promise.all([
    getClubReceptionKpis(),
    listTodayReceptions(search),
    getRecentModuleActivity("club-reception", 8),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess({ kpis, records, activity });
}
