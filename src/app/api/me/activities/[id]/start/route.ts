import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { startMyActivity } from "@/services/trainee-portal.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const submission = await startMyActivity(auth.trainee.id, id, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...getRequestMeta(req),
    });
    return apiSuccess(submission);
  } catch (err) {
    return handleServiceError(err, "me/activities/start");
  }
}
