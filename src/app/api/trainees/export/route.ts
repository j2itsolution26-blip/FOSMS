import type { NextRequest } from "next/server";

import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { traineeStatusEnum } from "@/validators/trainee.schema";
import { exportTraineesCsv } from "@/services/trainee.service";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const statusParam = searchParams.get("status");
  const status = statusParam ? traineeStatusEnum.safeParse(statusParam) : undefined;

  const csv = await exportTraineesCsv({
    status: status?.success ? status.data : undefined,
    batchId: searchParams.get("batchId") ?? undefined,
    instructorId: searchParams.get("instructorId") ?? undefined,
  });

  await recordAudit({
    userId: auth.user.id,
    role: auth.user.roles[0] ?? null,
    action: "REPORT_EXPORTED",
    module: "trainees",
    ...getRequestMeta(req),
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trainees-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
