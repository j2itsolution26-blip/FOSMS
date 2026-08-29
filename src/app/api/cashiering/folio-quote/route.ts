import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { computeFolioCharge } from "@/lib/folio-pricing";
import { discountTypeEnum } from "@/validators/cashiering.schema";

const folioQuoteSchema = z.object({
  roomTypeId: z.string().min(1),
  bedCount: z.coerce.number().int().min(0).max(10).optional(),
  discountType: discountTypeEnum.optional(),
});

/** Live price preview for the Guest Folio's Room Assignment section — read-only,
 * gated the same as the folio-creation flow it previews for. */
export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.GUESTS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = folioQuoteSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const charge = await computeFolioCharge(parsed.data);
    return apiSuccess(charge);
  } catch (err) {
    return handleServiceError(err, "cashiering/folio-quote");
  }
}
