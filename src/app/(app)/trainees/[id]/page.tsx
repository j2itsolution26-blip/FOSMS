import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getTraineeById } from "@/services/trainee.service";
import { TraineeProfile, type TraineeProfileData } from "@/components/trainees/trainee-profile";
import { NotFoundError } from "@/lib/errors";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Trainee Profile — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ id: string }> };

export default async function TraineeProfilePage({ params }: RouteParams) {
  const user = await requirePagePermission(PERMISSIONS.TRAINEES_VIEW);
  if (!user) return <AccessDenied />;

  const { id } = await params;

  let trainee;
  try {
    trainee = await getTraineeById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <TraineeProfile
      trainee={JSON.parse(JSON.stringify(trainee)) as TraineeProfileData}
      canRecordAttendance={hasPermission(user, PERMISSIONS.ATTENDANCE_RECORD)}
      canUploadDocuments={hasPermission(user, PERMISSIONS.TRAINEES_UPDATE)}
    />
  );
}
