import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { getLabResetPreview } from "@/services/lab-reset.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.LAB_DATA_RESET);
  if (auth.error) return auth.error;

  const counts = await getLabResetPreview();
  return apiSuccess(counts);
}
