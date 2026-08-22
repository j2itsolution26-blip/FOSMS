import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { createTransactionSchema } from "@/validators/cashiering.schema";
import { createTransaction } from "@/services/cashiering.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CASHIERING_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createTransactionSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const transaction = await createTransaction(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(transaction, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "cashiering/transactions/create");
  }
}
