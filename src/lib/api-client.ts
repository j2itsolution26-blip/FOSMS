export type PaginationMeta = { page: number; pageSize: number; total: number; totalPages: number };

export type ApiResult<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; message: string; code: string; errors: { path: string; message: string }[] };

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    // An uncaught exception (e.g. a route that throws before reaching any
    // apiError()/apiSuccess() call, like an unvalidated pagination param)
    // returns a bodyless/non-JSON response — surface it as a real error
    // result instead of an unhandled promise rejection callers never see.
    return {
      success: false,
      message: `Request failed (HTTP ${res.status}). Please try again.`,
      code: "INVALID_RESPONSE",
      errors: [],
    };
  }
}
