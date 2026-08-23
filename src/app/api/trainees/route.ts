import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { createTraineeSchema, traineeStatusEnum } from "@/validators/trainee.schema";
import { createTrainee, listTrainees } from "@/services/trainee.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);
  const statusParam = searchParams.get("status");
  const status = statusParam ? traineeStatusEnum.safeParse(statusParam) : undefined;
  const competencyProgress = searchParams.get("competencyProgress") as "under50" | "50to79" | "80plus" | null;

  const includeSummary = searchParams.get("includeSummary") === "true";

  const { rows, meta } = await listTrainees(pagination, {
    status: status?.success ? status.data : undefined,
    batchId: searchParams.get("batchId") ?? undefined,
    instructorId: searchParams.get("instructorId") ?? undefined,
    competencyProgress: competencyProgress ?? undefined,
  });

  if (includeSummary) {
    const { getTraineeKpis, listBatches, listInstructors } = await import("@/services/trainee.service");
    const { prisma } = await import("@/lib/prisma");

    const [kpis, batches, instructors, recentLogs] = await Promise.all([
      getTraineeKpis(),
      listBatches(),
      listInstructors(),
      prisma.auditLog.findMany({
        where: { module: "trainees" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const activity = recentLogs.map((log) => ({
      id: log.id,
      time: log.createdAt.toISOString(),
      label: `${log.action.replaceAll("_", " ")}: ${log.recordId || "record"}`,
    }));

    return apiSuccess(
      {
        rows,
        kpis,
        metaOptions: { batches, instructors },
        activity,
      },
      meta
    );
  }

  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINEES_CREATE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createTraineeSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const trainee = await createTrainee(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(trainee, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "trainees/create");
  }
}
