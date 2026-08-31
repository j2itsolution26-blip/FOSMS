import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getFrontOfficeKpis, listFrontOfficeActivity } from "@/services/front-office.service";
import { getRecentModuleActivity } from "@/services/audit.service";
import type { AuditLog } from "@prisma/client";

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

  const params = req.nextUrl.searchParams;
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const pageSize = Number(params.get("pageSize") ?? "25") || 25;

  const [kpis, operations, activityLogs] = await Promise.all([
    getFrontOfficeKpis(),
    listFrontOfficeActivity({
      search,
      activityType: params.get("activityType") ?? undefined,
      staff: params.get("staff") ?? undefined,
      status: params.get("status") ?? undefined,
      rangePreset: params.get("range") ?? "today",
      rangeFrom: params.get("from") ?? undefined,
      rangeTo: params.get("to") ?? undefined,
      page,
      pageSize,
    }),
    getRecentModuleActivity("front-office", 8),
  ]);

  const activity = activityLogs.map((log: AuditLog) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    action: log.action,
    label: describeActivity(log.action, log.newValue, log.previousValue),
  }));

  return apiSuccess({ kpis, operations: operations.rows, meta: operations.meta, filterOptions: operations.filterOptions, activity });
}
