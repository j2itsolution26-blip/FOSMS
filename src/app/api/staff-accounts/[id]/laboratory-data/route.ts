import type { NextRequest } from "next/server";

import { apiForbidden, apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/session";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { getStaffAccountLabData } from "@/services/staff-account.service";

type RouteContext = { params: Promise<{ id: string }> };

/** Live counts of one Front Desk account's laboratory data (never another account's). */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.USERS_MANAGE);
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user, PERMISSIONS.LAB_DATA_RESET)) return apiForbidden();

  const { id } = await params;
  try {
    return apiSuccess(await getStaffAccountLabData(id));
  } catch (err) {
    return handleServiceError(err, "staff-accounts/laboratory-data");
  }
}
