import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { PERMISSIONS } from "@/config/permissions";
import { parsePagination } from "@/validators/pagination.schema";
import { assessmentResultEnum, assessmentStatusEnum, createAssessmentSchema } from "@/validators/assessment.schema";
import { createAssessment, listAssessments } from "@/services/assessment.service";

export async function GET(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_VIEW);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);
  const statusParam = searchParams.get("status");
  const status = statusParam ? assessmentStatusEnum.safeParse(statusParam) : undefined;
  const resultParam = searchParams.get("result");
  const result = resultParam ? assessmentResultEnum.safeParse(resultParam) : undefined;

  const includeSummary = searchParams.get("includeSummary") === "true";

  const { rows, meta } = await listAssessments(pagination, {
    competencyId: searchParams.get("competencyId") ?? undefined,
    assessorId: searchParams.get("assessorId") ?? undefined,
    status: status?.success ? status.data : undefined,
    result: result?.success ? result.data : undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  if (includeSummary) {
    const { getAssessmentKpis, listAssessors } = await import("@/services/assessment.service");
    const { listCompetencies } = await import("@/services/competency.service");

    const [kpis, competencies, assessors] = await Promise.all([
      getAssessmentKpis(),
      listCompetencies(),
      listAssessors(),
    ]);

    const metaOptions = {
      competencies: competencies.map((c) => ({ id: c.id, title: c.title })),
      assessors: assessors.map((a) => ({ id: a.id, firstName: a.firstName, lastName: a.lastName })),
    };

    return apiSuccess({ rows, kpis, metaOptions }, meta);
  }

  return apiSuccess(rows, meta);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_CREATE);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = createAssessmentSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const assessment = await createAssessment(parsed.data, { userId: auth.user.id, role: auth.user.roles[0] ?? null, ...getRequestMeta(req) });
    return apiSuccess(assessment, undefined, 201);
  } catch (err) {
    return handleServiceError(err, "assessments/create");
  }
}
