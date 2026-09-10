import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

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
    // nothing was partially deleted, so this is never "some rows deleted,
    // some not." Full error (SQL and all) goes to the server log.
    console.error("[admin/laboratory-data/reset]", err);

    // The Supervisor running a reset needs to know WHY it failed, not just
    // that it did — a bare "reset failed" is what made the earlier
    // ClubMembership foreign-key failure look like "nothing to delete". Only
    // the bounded, non-sensitive part of the error is surfaced (Prisma's
    // error code plus the model it tripped on, e.g. "P2003 on ClubMembership"),
    // never raw SQL or row values, and only on this LAB_DATA_RESET-gated
    // maintenance endpoint.
    const detail =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? ` (${err.code}${typeof err.meta?.modelName === "string" ? ` on ${err.meta.modelName}` : ""})`
        : "";

    return apiError(
      `Reset failed${detail} — no changes were made. Every record was rolled back; see the server log for the full error.`,
      "LAB_RESET_FAILED",
      500
    );
  }
}
