import { AppError } from "@/lib/errors";
import { apiError, apiServerError } from "@/lib/api-response";

/** Route-handler catch-block helper: maps a known AppError to its structured status/code, logs and masks anything else. */
export function handleServiceError(err: unknown, logContext: string) {
  if (err instanceof AppError) return apiError(err.message, err.code, err.status);
  console.error(`[${logContext}]`, err);
  return apiServerError();
}
