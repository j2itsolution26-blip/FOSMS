import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { bulkAttendanceSchema } from "@/validators/attendance.schema";
import { bulkRecordAttendance } from "@/services/attendance.service";

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ATTENDANCE_RECORD);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = bulkAttendanceSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const results = await bulkRecordAttendance(parsed.data.date, parsed.data.entries, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(results, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "attendance/bulk");
  }
}
