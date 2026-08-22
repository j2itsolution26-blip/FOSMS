import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getRecentTrainingActivityActivity } from "@/services/training-activity.service";

function describeActivity(action: string, newValue: unknown) {
  const v = (newValue ?? {}) as Record<string, unknown>;
  switch (action) {
    case "TRAINING_ACTIVITY_CREATED":
      return `Activity created: ${v.title ?? ""}`;
    case "TRAINING_ACTIVITY_ASSIGNED":
      return `Assigned to ${v.traineeCount ?? 0} trainee(s)`;
    case "TRAINING_ACTIVITY_GRADED":
      return `Graded — score ${v.score ?? ""}`;
    default:
      return action;
  }
}

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const logs = await getRecentTrainingActivityActivity(8);
  return apiSuccess(
    logs.map((log) => ({
      id: log.id,
      time: log.createdAt.toISOString(),
      label: describeActivity(log.action, log.newValue),
    }))
  );
}
