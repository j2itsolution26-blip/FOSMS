import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { payTransactionSchema } from "@/validators/cashiering.schema";
import { payTransaction } from "@/services/cashiering.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.CASHIERING_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = payTransactionSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const charge = await payTransaction(
      { transactionId: id, amount: parsed.data.amount, reference: parsed.data.reference, processedBy: parsed.data.processedBy },
      { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) }
    );
    return apiSuccess(charge);
  } catch (err) {
    return handleServiceError(err, "cashiering/transactions/pay");
  }
}
