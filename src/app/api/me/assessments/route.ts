import { apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getMyAssessments } from "@/services/trainee-portal.service";

export async function GET() {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const assessments = await getMyAssessments(auth.trainee.id);
  return apiSuccess(assessments);
}
