import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRecentModuleActivity } from "@/services/audit.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "CREATE":
      return `Trainee enrolled: ${v.studentNumber ?? ""} (${v.email ?? ""})`;
    case "UPDATE":
      return `Trainee record updated`;
    case "DELETE":
      return `Trainee archived`;
    case "ATTENDANCE_RECORDED":
      return `Attendance recorded: ${v.status ?? ""} on ${v.date ?? ""}`;
    case "EVIDENCE_UPLOADED":
      return `Document uploaded: ${v.fileName ?? ""}`;
    default:
      return action;
  }
}

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const logs = await getRecentModuleActivity("trainees", 8);
  const activity = logs.map((log) => ({
    id: log.id,
    time: log.createdAt.toISOString(),
    label: describeActivity(log.action, log.newValue),
  }));

  return apiSuccess(activity);
}
