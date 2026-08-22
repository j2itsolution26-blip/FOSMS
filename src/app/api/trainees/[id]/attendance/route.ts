import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { recordAttendanceSchema } from "@/validators/trainee.schema";
import { recordAttendance } from "@/services/trainee.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ATTENDANCE_RECORD);
  if (auth.error) return auth.error;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = recordAttendanceSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const attendance = await recordAttendance(
      id,
      parsed.data.date,
      parsed.data.status,
      parsed.data.remarks,
      { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) }
    );
    return apiSuccess(attendance, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "trainees/attendance");
  }
}
