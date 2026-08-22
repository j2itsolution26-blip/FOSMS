import { apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { handleServiceError } from "@/lib/handle-service-error";
import { getMyAssessmentById } from "@/services/trainee-portal.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const assessment = await getMyAssessmentById(auth.trainee.id, id);
    return apiSuccess(assessment);
  } catch (err) {
    return handleServiceError(err, "me/assessments/get");
  }
}
