import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional().default(""),
  sortBy: z.string().trim().max(100).optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function parsePagination(searchParams: URLSearchParams) {
  return paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortDir: searchParams.get("sortDir") ?? undefined,
  });
}

export function paginationMeta(total: number, { page, pageSize }: { page: number; pageSize: number }) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
