import type { NextRequest } from "next/server";

import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS } from "@/lib/auth/constants";
import { getRequestMeta } from "@/lib/request-meta";
import { requestPasswordResetSchema } from "@/validators/password-reset.schema";
import { requestPasswordReset } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);

  const rateLimitKey = `password-reset:${meta.ipAddress ?? "unknown"}`;
  const rateLimit = checkRateLimit(rateLimitKey, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS);
  if (!rateLimit.allowed) {
    return apiError("Too many requests. Please wait a moment and try again.", "RATE_LIMITED", 429);
  }

  const json = await req.json().catch(() => null);
  const parsed = requestPasswordResetSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  await requestPasswordReset(parsed.data.email, meta);

  // Same response whether or not the email is registered — never confirm/deny an account's existence.
  return apiSuccess({ message: "If an account exists for that email address, we've sent password reset instructions." });
}
