import type { NextRequest } from "next/server";
import type { AuditAction } from "@prisma/client";

import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { listAuditLogs } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.AUDIT_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);

  const { rows, meta } = await listAuditLogs(pagination, {
    module: searchParams.get("module") ?? undefined,
    action: (searchParams.get("action") as AuditAction | null) ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  return apiSuccess(rows, meta);
}
