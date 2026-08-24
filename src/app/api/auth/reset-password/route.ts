import type { NextRequest } from "next/server";

import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS } from "@/lib/auth/constants";
import { getRequestMeta } from "@/lib/request-meta";
import { resetPasswordSchema } from "@/validators/password-reset.schema";
import { resetPassword } from "@/services/auth.service";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);

  const rateLimitKey = `password-reset-submit:${meta.ipAddress ?? "unknown"}`;
  const rateLimit = checkRateLimit(rateLimitKey, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS);
  if (!rateLimit.allowed) {
    return apiError("Too many attempts. Please wait a moment and try again.", "RATE_LIMITED", 429);
  }

  const json = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    await resetPassword(parsed.data.token, parsed.data.password, meta);
    return apiSuccess({ message: "Your password has been reset. You can now sign in." });
  } catch (err) {
    if (err instanceof AppError) return apiError(err.message, err.code, err.status);
    console.error("[auth/reset-password]", err);
    return apiError("Something went wrong. Please try again.", "INTERNAL_ERROR", 500);
  }
}
