import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { invalidateResetTokensForUser } from "@/lib/auth/password-reset-store";
import type { ChangeOwnPasswordInput } from "@/validators/account.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

/**
 * Everything a password replacement must do besides writing the new hash,
 * lifted from the existing self-service reset flow (resetPassword in
 * auth.service.ts) so an admin-issued reset and a token-based one leave an
 * account in exactly the same state:
 *   - passwordResetAt stamped, so "when was this last changed" stays truthful
 *   - failedLoginCount/lockedUntil cleared, so a locked-out account is usable
 *     again with its new password instead of staying locked (lockout.ts)
 *   - every existing session revoked — the old credential may be compromised
 *   - any outstanding "forgot password" token invalidated, so an email link
 *     issued before this change can't resurrect a password nobody expects
 * Only the password columns are ever written: role, email, name and isActive
 * are untouched by design (a deactivated trainee account stays deactivated —
 * see resetStaffAccountPassword in staff-account.service.ts).
 */
export async function applyNewPassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordResetAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  await revokeAllUserSessions(userId);
  invalidateResetTokensForUser(userId);
}

/**
 * The signed-in user replaces their own password. `userId` always comes from
 * the server-side session — never from the request body — so this can only
 * ever change the caller's own credential.
 *
 * Every session is revoked (see applyNewPassword), including the caller's
 * own: the route immediately issues them a fresh session cookie so the device
 * they just used stays signed in while every other device is signed out.
 */
export async function changeOwnPassword(userId: string, input: ChangeOwnPasswordInput, actor: ActorContext) {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive) throw new NotFoundError("Account not found.");

  // Verified against the stored hash only — the existing password is never
  // read back, displayed, or returned anywhere in this flow.
  const currentPasswordValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    throw new AppError("The current password you entered is incorrect.", "INVALID_CURRENT_PASSWORD", 400);
  }

  await applyNewPassword(user.id, input.newPassword);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "auth",
    recordId: user.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { event: "PASSWORD_CHANGED_SELF" },
  });
}
