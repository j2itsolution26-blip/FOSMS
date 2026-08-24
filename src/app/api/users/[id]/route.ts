import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError, apiForbidden } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { updateUserSchema } from "@/validators/user.schema";
import { getUserById, updateUser } from "@/services/user.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const user = await getUserById(id);
    return apiSuccess(user);
  } catch (err) {
    return handleServiceError(err, "users/get");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (id === auth.user.id) {
    return apiForbidden();
  }

  const json = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const user = await updateUser(id, parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null });
    return apiSuccess(user);
  } catch (err) {
    return handleServiceError(err, "users/update");
  }
}
