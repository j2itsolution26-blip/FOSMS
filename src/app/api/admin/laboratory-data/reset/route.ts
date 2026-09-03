import type { NextRequest } from "next/server";

import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { PERMISSIONS } from "@/config/permissions";
import { resetLaboratoryDataSchema } from "@/validators/lab-reset.schema";
import { resetLaboratoryData } from "@/services/lab-reset.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.LAB_DATA_RESET);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  // Defense-in-depth: re-validated here even though the UI already gates the
  // button behind a typed "RESET" and a second confirmation step — this is
  // an irreversible, all-data-destroying action, so the server never trusts
  // client-side gating alone.
  const parsed = resetLaboratoryDataSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const counts = await resetLaboratoryData({
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(counts);
  } catch (err) {
    // Prisma's $transaction already rolled back everything on any failure —
    // nothing was partially deleted. Never surface the raw DB error to the
    // client (per spec: "Do not expose database errors to normal users").
    console.error("[admin/laboratory-data/reset]", err);
    return apiError("Reset failed. No data was deleted.", "LAB_RESET_FAILED", 500);
  }
}
