import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getFrontOfficeKpis, listTodayOperations } from "@/services/front-office.service";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown, previousValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "CHECK_IN":
      return `Checked in ${v.guestName ?? "guest"} — Room ${v.roomNumber ?? "?"}`;
    case "CHECK_OUT":
      return `Checked out ${v.guestName ?? "guest"} — Room ${v.roomNumber ?? "?"}`;
    case "WALK_IN":
      return `Walk-in: ${v.guestName ?? "guest"} — Room ${v.roomNumber ?? "?"} (${v.reservationNo ?? ""})`;
    case "ROOM_TRANSFER": {
      const from = (previousValue as Record<string, unknown> | null)?.roomNumber ?? "?";
      return `Transferred ${v.guestName ?? "guest"} from Room ${from} to Room ${v.roomNumber ?? "?"}`;
    }
    case "GUEST_VERIFICATION":
      return `Verified guest ID: ${v.guestName ?? "guest"} — Room ${v.roomNumber ?? "?"}`;
    case "SERVICE_REQUEST_CREATED":
      return `Logged guest request ${v.requestNo ?? ""}: ${v.description ?? ""}`;
    default:
      return action;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.FRONT_OFFICE_VIEW);
  if (auth.error) return auth.error;

  const search = req.nextUrl.searchParams.get("search") ?? "";

  const [kpis, operations, activityLogs] = await Promise.all([
    getFrontOfficeKpis(),
    listTodayOperations(search),
    getRecentModuleActivity("front-office", 8),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue, log.previousValue),
  }));

  return apiSuccess({ kpis, operations, activity });
}
