import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getReceiptKpis } from "@/services/cashiering.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.CASHIERING_VIEW);
  if (auth.error) return auth.error;

  try {
    const kpis = await getReceiptKpis();
    return apiSuccess(kpis);
  } catch (err) {
    return handleServiceError(err, "cashiering/receipts/kpis");
  }
}
