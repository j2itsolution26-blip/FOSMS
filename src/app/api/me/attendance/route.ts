import { apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getMyAttendance } from "@/services/trainee-portal.service";

export async function GET() {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const attendance = await getMyAttendance(auth.trainee.id);
  return apiSuccess(attendance);
}
