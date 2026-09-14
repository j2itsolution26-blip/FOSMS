import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { invalidateResetTokensForUser } from "@/lib/auth/password-reset-store";
import type { RoleName } from "@prisma/client";
import {
  TRAINEE_CANDIDATE_DISPLAY_NAME,
  TRAINEE_CANDIDATE_ROLE_SUBTITLE,
  TRAINEE_CANDIDATE_ROLES,
} from "@/config/role-display";
import type { ChangeOwnPasswordInput, ResetAccountPasswordInput } from "@/validators/account.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

/** The roles whose sign-in the system presents as "Trainee / Candidate" —
 * the only account a Supervisor manages here, never another Supervisor's, an
 * Administrator's, or their own (that goes through changeOwnPassword, which
 * requires the current password). Read from the same ROLE_DISPLAY map the
 * sidebar labels accounts with, so this can never drift from what the trainee
 * actually sees themselves signed in as. */
const TRAINEE_ACCOUNT_ROLES = TRAINEE_CANDIDATE_ROLES as RoleName[];

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
 * Resolves THE Trainee / Candidate login — the single non-Supervisor account
 * this training system signs students in with. Deliberately returns one
 * account and not a list: there is exactly one trainee login, and an id
 * parameter a caller could substitute is the thing that would turn this into
 * multi-account password management.
 *
 * Only active, non-deleted accounts are considered: a deactivated seed login
 * is not a credential anybody can sign in with, so it is not something to
 * offer a reset for. If the system ever ends up with more than one, this
 * refuses rather than guessing which person's credential to overwrite.
 *
 * Returns identity and status columns only — no password material of any
 * kind, hashed or otherwise, ever leaves this function.
 */
async function resolveTraineeAccount() {
  const accounts = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      roles: { some: { role: { name: { in: TRAINEE_ACCOUNT_ROLES } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 2,
    select: {
      id: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      passwordResetAt: true,
      lockedUntil: true,
    },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("The Trainee / Candidate account could not be found.");
  }
  if (accounts.length > 1) {
    throw new AppError(
      "More than one active Trainee / Candidate account exists, so this reset cannot tell which one to change.",
      "TRAINEE_ACCOUNT_AMBIGUOUS",
      409
    );
  }

  return accounts[0];
}

/**
 * The Trainee / Candidate account as the Supervisor's account screen shows
 * it: labelled exactly the way the sidebar labels it for the trainee, with
 * the status columns that make a reset decision informed (locked out? never
 * signed in?). No password material is included.
 */
export async function getTraineeAccount() {
  const account = await resolveTraineeAccount();

  return {
    accountName: TRAINEE_CANDIDATE_DISPLAY_NAME,
    roleLabel: TRAINEE_CANDIDATE_ROLE_SUBTITLE,
    email: account.email,
    isActive: account.isActive,
    lastLoginAt: account.lastLoginAt,
    passwordResetAt: account.passwordResetAt,
    isLocked: !!account.lockedUntil && account.lockedUntil > new Date(),
  };
}

/**
 * A Supervisor issues a new password for the Trainee / Candidate account.
 *
 * The target is resolved server-side from the role — there is no id
 * parameter, so this endpoint structurally cannot be pointed at a
 * Supervisor's or an Administrator's credential, and cannot be used to skip
 * the current-password check that changeOwnPassword enforces. The caller
 * being the target is impossible for the same reason: a Supervisor is not a
 * Trainee / Candidate account.
 *
 * Nothing but the password columns is written: role, permissions, email,
 * name and isActive are all left exactly as they were.
 */
export async function resetTraineeAccountPassword(input: ResetAccountPasswordInput, actor: ActorContext) {
  const target = await resolveTraineeAccount();

  if (target.id === actor.userId) {
    throw new AppError(
      "Use Change Password to update your own account — it requires your current password.",
      "CANNOT_RESET_OWN_ACCOUNT",
      400
    );
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

  return { accountName: TRAINEE_CANDIDATE_DISPLAY_NAME, roleLabel: TRAINEE_CANDIDATE_ROLE_SUBTITLE };
}
