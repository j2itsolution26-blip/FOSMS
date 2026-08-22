export type PaginationMeta = { page: number; pageSize: number; total: number; totalPages: number };

export type ApiResult<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; message: string; code: string; errors: { path: string; message: string }[] };

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await res.json()) as ApiResult<T>;
}
