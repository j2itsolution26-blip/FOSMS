import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getAttendanceKpis, getAttendanceRoster, getRecentAttendanceActivity } from "@/services/attendance.service";
import { listBatches, listInstructors } from "@/services/trainee.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  if (action === "ATTENDANCE_RECORDED") return `Attendance marked ${v.status ?? ""} for ${v.date ?? ""}`;
  return action;
}

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ATTENDANCE_VIEW);
  if (auth.error) return auth.error;

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const batchId = searchParams.get("batchId") || undefined;
  const instructorId = searchParams.get("instructorId") || undefined;
  const search = searchParams.get("search") || undefined;

  const [roster, kpis, activityLogs, batches, instructors] = await Promise.all([
    getAttendanceRoster(date, { batchId, instructorId, search }),
    getAttendanceKpis(date),
    getRecentAttendanceActivity(8),
    listBatches(),
    listInstructors(),
  ]);

  const activity = activityLogs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess({
    date,
    roster,
    kpis,
    activity,
    batches: batches.map((b) => ({ id: b.id, code: b.code })),
    instructors: instructors.map((i) => ({ id: i.id, name: `${i.user.firstName} ${i.user.lastName}` })),
  });
}
