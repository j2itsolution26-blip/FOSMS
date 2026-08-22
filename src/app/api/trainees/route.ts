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

  const { rows, meta } = await listTrainees(pagination, {
    status: status?.success ? status.data : undefined,
    batchId: searchParams.get("batchId") ?? undefined,
    instructorId: searchParams.get("instructorId") ?? undefined,
    competencyProgress: competencyProgress ?? undefined,
  });

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
