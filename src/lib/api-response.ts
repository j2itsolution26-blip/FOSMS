import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorBody = {
  success: false;
  message: string;
  code: string;
  errors: { path: string; message: string }[];
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  const body: ApiSuccessBody<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return NextResponse.json(body, { status });
}

export function apiError(
  message: string,
  code: string,
  status: number,
  errors: { path: string; message: string }[] = []
) {
  const body: ApiErrorBody = { success: false, message, code, errors };
  return NextResponse.json(body, { status });
}

export function apiValidationError(error: ZodError) {
  return apiError(
    "Validation failed.",
    "VALIDATION_ERROR",
    422,
    error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
  );
}

export const apiUnauthorized = () => apiError("Authentication required.", "UNAUTHORIZED", 401);
export const apiForbidden = () => apiError("You do not have permission to perform this action.", "FORBIDDEN", 403);
export const apiNotFound = (message = "Resource not found.") => apiError(message, "NOT_FOUND", 404);
export const apiConflict = (message: string, code = "CONFLICT") => apiError(message, code, 409);
export const apiServerError = () =>
  apiError("Something went wrong. Please try again.", "INTERNAL_ERROR", 500);
