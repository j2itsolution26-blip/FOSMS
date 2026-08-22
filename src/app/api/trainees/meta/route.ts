import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listBatches, listInstructors, listPrograms } from "@/services/trainee.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const [programs, batches, instructors] = await Promise.all([listPrograms(), listBatches(), listInstructors()]);
  return apiSuccess({ programs, batches, instructors });
}
