import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { invalidateResetTokensForUser } from "@/lib/auth/password-reset-store";
import type { ChangeOwnPasswordInput, ResetAccountPasswordInput } from "@/validators/account.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

/** The role whose passwords this feature is allowed to reset. Trainee logins
 * are the only accounts a Supervisor manages here — never another
 * Supervisor's, an Administrator's, or their own (that goes through
 * changeOwnPassword, which requires the current password). */
const MANAGEABLE_ROLE = "TRAINEE" as const;

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
 * are untouched by design (an inactive trainee account stays inactive).
 */
async function applyNewPassword(userId: string, newPassword: string) {
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

/**
 * The trainee logins a Supervisor may issue a new password for. Returns only
 * identity and status columns — no password material of any kind, hashed or
 * otherwise, ever leaves this function.
 */
export async function listManagedAccounts() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, roles: { some: { role: { name: MANAGEABLE_ROLE } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      passwordResetAt: true,
      lockedUntil: true,
      trainee: { select: { studentNumber: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    passwordResetAt: u.passwordResetAt,
    studentNumber: u.trainee?.studentNumber ?? null,
  }));
}

/**
 * A Supervisor issues a new temporary password for a trainee account.
 *
 * Defence in depth: the route already requires USERS_MANAGE, and this
 * re-checks server-side that the target really is a trainee account and not
 * the caller themselves — so this endpoint can never be pointed at a
 * Supervisor/Administrator account, and can never be used to skip the
 * current-password check that changeOwnPassword enforces. Nothing but the
 * password columns is written: role, permissions, email, name and isActive
 * are all left exactly as they were.
 */
export async function resetAccountPassword(
  targetUserId: string,
  input: ResetAccountPasswordInput,
  actor: ActorContext
) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!target) throw new NotFoundError("Account not found.");

  if (target.id === actor.userId) {
    throw new AppError(
      "Use Change My Password to update your own account — it requires your current password.",
      "CANNOT_RESET_OWN_ACCOUNT",
      400
    );
  }

  const isManageable = target.roles.some((r) => r.role.name === MANAGEABLE_ROLE);
  if (!isManageable) {
    throw new AppError("Only trainee account passwords can be reset here.", "ACCOUNT_NOT_MANAGEABLE", 403);
  }

  await applyNewPassword(target.id, input.newPassword);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "users",
    recordId: target.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { event: "PASSWORD_RESET_BY_SUPERVISOR", targetEmail: target.email },
  });

  return { id: target.id, firstName: target.firstName, lastName: target.lastName, email: target.email };
}
