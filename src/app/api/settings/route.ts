import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { settingsSchema } from "@/validators/settings.schema";
import { getSettings, updateSettings } from "@/services/settings.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.SETTINGS_MANAGE);
  if (auth.error) return auth.error;

  const settings = await getSettings();
  return apiSuccess(settings);
}

export async function PATCH(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.SETTINGS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const settings = await updateSettings(parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(settings);
  } catch (err) {
    return handleServiceError(err, "settings/update");
  }
}
