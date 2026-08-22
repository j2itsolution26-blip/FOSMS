import type { NextRequest } from "next/server";

import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS } from "@/lib/auth/constants";
import { getRequestMeta } from "@/lib/request-meta";
import { loginSchema } from "@/validators/auth.schema";
import { login } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);

  const rateLimitKey = `login:${meta.ipAddress ?? "unknown"}`;
  const rateLimit = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX_ATTEMPTS);
  if (!rateLimit.allowed) {
    return apiError("Too many sign-in attempts. Please wait a moment and try again.", "RATE_LIMITED", 429);
  }

  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const { token, expiresAt, user } = await login(parsed.data.email, parsed.data.password, meta);
    await setSessionCookie(token, expiresAt);

    return apiSuccess({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    if (err instanceof AppError) return apiError(err.message, err.code, err.status);
    console.error("[auth/login]", err);
    return apiError("Something went wrong. Please try again.", "INTERNAL_ERROR", 500);
  }
}
