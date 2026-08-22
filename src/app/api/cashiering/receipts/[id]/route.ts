import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getReceiptById } from "@/services/cashiering.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.CASHIERING_VIEW);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const receipt = await getReceiptById(id);
    return apiSuccess(receipt);
  } catch (err) {
    return handleServiceError(err, "cashiering/receipts/get");
  }
}
