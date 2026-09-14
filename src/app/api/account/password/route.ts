import type { NextRequest } from "next/server";

import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { handleServiceError } from "@/lib/handle-service-error";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { changeOwnPasswordSchema } from "@/validators/account.schema";
import { changeOwnPassword } from "@/services/account.service";

/**
 * Change the signed-in user's own password.
 *
 * Authenticated-only rather than permission-gated on purpose: the account it
 * writes to is always `auth.user.id` from the server-side session, never an
 * id from the request body, so it structurally cannot touch anyone else's
 * credential. The Supervisor-only surface is the page itself
 * (/admin/account, gated on USERS_MANAGE) and the separate reset endpoint.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = changeOwnPasswordSchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const meta = getRequestMeta(req);

  try {
    await changeOwnPassword(auth.user.id, parsed.data, {
      userId: auth.user.id,
      role: auth.user.roles[0] ?? null,
      ...meta,
    });

    // Changing a password revokes every session for the account, including
    // the one that made this request. Issuing a fresh session here keeps the
    // device they just used signed in — every OTHER device stays signed out,
    // which is the point.
    const { token, expiresAt } = await createSession(auth.user.id, meta);
    await setSessionCookie(token, expiresAt);

    return apiSuccess({ changed: true });
  } catch (err) {
    return handleServiceError(err, "account/password");
  }
}
