import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { getRequestMeta } from "@/lib/request-meta";
import { getCurrentSessionId, getCurrentUser, clearSessionCookie } from "@/lib/auth/session";
import { logout } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);
  const [user, sessionId] = await Promise.all([getCurrentUser(), getCurrentSessionId()]);

  if (user && sessionId) {
    await logout(sessionId, user.id, user.roles[0] ?? null, meta);
  }

  await clearSessionCookie();
  return apiSuccess({ loggedOut: true });
}
