import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { createUserSchema } from "@/validators/user.schema";
import { createUser, listUsers } from "@/services/user.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const pagination = parsePagination(req.nextUrl.searchParams);
  const { rows, meta } = await listUsers(pagination);
  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const user = await createUser(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(user, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "users/create");
  }
}
