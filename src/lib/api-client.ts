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
    const body = (await res.json()) as ApiResult<T>;
    // The account was deactivated while this tab was open — leave the app
    // instead of letting the page keep failing request by request.
    if (res.status === 401 && !body.success && body.code === "ACCOUNT_DEACTIVATED" && typeof window !== "undefined") {
      // A full reload (not router.push) on purpose: it drops every piece of
      // client state the deactivated account had loaded.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?reason=deactivated");
    }
    return body;
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
