import type { Metadata } from "next";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { getMyAttendance } from "@/services/trainee-portal.service";
import { MyAttendanceView } from "@/components/trainee-portal/my-attendance-view";

export const metadata: Metadata = { title: "My Attendance — Front Office Servicing NC II" };

export default async function MyAttendancePage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  const attendance = await getMyAttendance(ctx.trainee.id);
  return <MyAttendanceView attendance={attendance} />;
}
