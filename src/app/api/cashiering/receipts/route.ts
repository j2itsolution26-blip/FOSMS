import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { paymentMethodEnum, receiptStatusEnum } from "@/validators/cashiering.schema";
import { listReceipts } from "@/services/cashiering.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.CASHIERING_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);

  const statusParam = searchParams.get("status");
  const status = statusParam ? receiptStatusEnum.safeParse(statusParam) : undefined;
  const methodParam = searchParams.get("paymentMethod");
  const paymentMethod = methodParam ? paymentMethodEnum.safeParse(methodParam) : undefined;

  try {
    const { rows, meta } = await listReceipts(pagination, {
      status: status?.success ? status.data : undefined,
      paymentMethod: paymentMethod?.success ? paymentMethod.data : undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });
    return apiSuccess(rows, meta);
  } catch (err) {
    return handleServiceError(err, "cashiering/receipts/list");
  }
}
