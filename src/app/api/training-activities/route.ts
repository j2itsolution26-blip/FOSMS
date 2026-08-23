import type { NextRequest } from "next/server";

import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { createTrainingActivitySchema } from "@/validators/training-activity.schema";
import { createActivity, listTrainingActivities } from "@/services/training-activity.service";
import type { TrainingActivityStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const { searchParams } = req.nextUrl;
  const pagination = parsePagination(searchParams);
  const status = searchParams.get("status") || undefined;
  const competencyId = searchParams.get("competencyId") || undefined;
  const instructorId = searchParams.get("instructorId") || undefined;

  const includeSummary = searchParams.get("includeSummary") === "true";

  const { rows, meta } = await listTrainingActivities(pagination, {
    status: status as TrainingActivityStatus | undefined,
    competencyId,
    instructorId,
  });

  if (includeSummary) {
    const { getTrainingActivityKpis, getRecentTrainingActivityActivity } = await import("@/services/training-activity.service");
    const { listInstructors } = await import("@/services/trainee.service");
    const { listCompetencies } = await import("@/services/competency.service");
    const { prisma } = await import("@/lib/prisma");

    const [kpis, recentLogs, instructors, competencies, trainees] = await Promise.all([
      getTrainingActivityKpis(),
      getRecentTrainingActivityActivity(),
      listInstructors(),
      listCompetencies(),
      prisma.trainee.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { studentNumber: "asc" },
      }),
    ]);

    const activity = recentLogs.map((log) => ({
      id: log.id,
      time: log.createdAt.toISOString(),
      label: log.user ? `${log.user.firstName} ${log.user.lastName}: ${log.action.replaceAll("_", " ").toLowerCase()}` : log.action,
    }));

    const metaOptions = {
      instructors: instructors.map((i) => ({ id: i.id, name: `${i.user.firstName} ${i.user.lastName}` })),
      competencies: competencies.map((c) => ({ id: c.id, code: c.code, title: c.title })),
      trainees: trainees.map((t) => ({ id: t.id, studentNumber: t.studentNumber, name: `${t.user.firstName} ${t.user.lastName}` })),
    };

    return apiSuccess({ rows, kpis, activity, metaOptions }, meta);
  }

  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_MANAGE);
  if (auth.error) return auth.error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError("A valid form submission is required.", "VALIDATION_ERROR", 422);

  const payload = {
    instructorId: String(formData.get("instructorId") ?? ""),
    competencyId: String(formData.get("competencyId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    instructions: String(formData.get("instructions") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
  };
  const parsed = createTrainingActivitySchema.safeParse(payload);
  if (!parsed.success) return apiValidationError(parsed.error);

  const file = formData.get("file");

  try {
    const activity = await createActivity(parsed.data, file instanceof File ? file : null, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(activity, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "training-activities/create");
  }
}
