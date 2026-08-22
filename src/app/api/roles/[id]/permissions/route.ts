import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { setRolePermissions } from "@/services/role.service";

const bodySchema = z.object({ permissions: z.array(z.string()) });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ROLES_MANAGE);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const roles = await setRolePermissions(id, parsed.data.permissions as never, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
    });
    return apiSuccess(roles);
  } catch (err) {
    return handleServiceError(err, "roles/permissions");
  }
}
