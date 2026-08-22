import "server-only";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasPermission, type SessionUser } from "@/lib/auth/session";
import { apiForbidden, apiUnauthorized } from "@/lib/api-response";
import { PERMISSIONS } from "@/config/permissions";

export type OwnTrainee = {
  id: string;
  userId: string;
  studentNumber: string;
  status: string;
};

/**
 * Resolves the caller's own `Trainee` row from their session — never from a
 * client-supplied id. This is the sole gate for every `/api/me/*` and
 * trainee-portal route: a TRAINEE user can only ever see/act on the Trainee
 * record tied to their own userId, by construction (no id parameter exists
 * for them to substitute).
 */
async function resolveOwnTrainee(user: SessionUser): Promise<OwnTrainee | null> {
  if (!hasPermission(user, PERMISSIONS.TRAINEE_PORTAL_ACCESS)) return null;
  const trainee = await prisma.trainee.findUnique({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, userId: true, studentNumber: true, status: true },
  });
  return trainee;
}

/** Page-level guard for trainee-portal pages. Redirects if unauthenticated, returns null if forbidden/no profile. */
export async function requireOwnTraineePage(): Promise<{ user: SessionUser; trainee: OwnTrainee } | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const trainee = await resolveOwnTrainee(user);
  if (!trainee) return null;
  return { user, trainee };
}

type ApiGuardResult =
  | { user: SessionUser; trainee: OwnTrainee; error?: undefined }
  | { user?: undefined; trainee?: undefined; error: NextResponse };

/** Route-handler guard for /api/me/* endpoints. */
export async function authorizeOwnTrainee(): Promise<ApiGuardResult> {
  const user = await getCurrentUser();
  if (!user) return { error: apiUnauthorized() };
  const trainee = await resolveOwnTrainee(user);
  if (!trainee) return { error: apiForbidden() };
  return { user, trainee };
}
