import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { TrainingActivitiesClient } from "@/components/training-activities/training-activities-client";

export const metadata: Metadata = { title: "Training Activities — Front Office Servicing NC II" };

export default async function TrainingActivitiesPage() {
  const user = await requirePagePermission(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (!user) return <AccessDenied />;

  return <TrainingActivitiesClient canManage={hasPermission(user, PERMISSIONS.TRAINING_ACTIVITIES_MANAGE)} />;
}
