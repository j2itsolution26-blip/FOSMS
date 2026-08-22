import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { guestSchema } from "@/validators/guest.schema";
import { createGuest, listGuests } from "@/services/guest.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.GUESTS_VIEW);
  if (auth.error) return auth.error;

  const pagination = parsePagination(req.nextUrl.searchParams);
  const { rows, meta } = await listGuests(pagination);
  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.GUESTS_MANAGE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = guestSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    const guest = await createGuest(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...meta });
    return apiSuccess(guest, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "guests/create");
  }
}
