import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { parsePagination } from "@/validators/pagination.schema";
import { getMyActivities } from "@/services/trainee-portal.service";
import type { SubmissionStatus } from "@prisma/client";

const VALID_STATUSES: SubmissionStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "COMPLETED", "OVERDUE"];

export async function GET(req: NextRequest) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const pagination = parsePagination(searchParams);
  const statusParam = searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam as SubmissionStatus) ? (statusParam as SubmissionStatus) : undefined;

  const { rows, meta } = await getMyActivities(auth.trainee.id, pagination, {
    status,
    competencyId: searchParams.get("competencyId") ?? undefined,
  });

  return apiSuccess(rows, meta);
}
