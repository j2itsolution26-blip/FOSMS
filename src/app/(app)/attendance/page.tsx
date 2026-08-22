import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AttendanceClient } from "@/components/attendance/attendance-client";

export const metadata: Metadata = { title: "Attendance — Front Office Servicing NC II" };

export default async function AttendancePage() {
  const user = await requirePagePermission(PERMISSIONS.ATTENDANCE_VIEW);
  if (!user) return <AccessDenied />;

  return <AttendanceClient canRecord={hasPermission(user, PERMISSIONS.ATTENDANCE_RECORD)} />;
}
