import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, revokeSession, revokeAllUserSessions } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { isLocked, registerFailedLogin, resetFailedLogin } from "@/lib/auth/lockout";
import { storeResetToken, consumeResetToken, invalidateResetTokensForUser } from "@/lib/auth/password-reset-store";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { recordAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export async function login(email: string, password: string, meta: RequestMeta) {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    include: { roles: { include: { role: true } } },
  });

  // Constant-shaped failure path: don't reveal whether the email exists.
  if (!user) {
    await recordAudit({
      action: "LOGIN_FAILED",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      result: "FAILURE",
      newValue: { email },
    });
    throw new AppError("Invalid email or password.", "INVALID_CREDENTIALS", 401);
  }

  if (isLocked(user)) {
    await recordAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      result: "LOCKED",
    });
    throw new AppError(
      "This account is temporarily locked due to repeated failed sign-in attempts. Try again later.",
      "ACCOUNT_LOCKED",
      423
    );
  }

  if (!user.isActive) {
    throw new AppError("This account has been deactivated. Contact an administrator.", "ACCOUNT_INACTIVE", 403);
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await registerFailedLogin(user.id);
    await recordAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      result: "FAILURE",
    });
    throw new AppError("Invalid email or password.", "INVALID_CREDENTIALS", 401);
  }

  const primaryRole = user.roles[0]?.role.name ?? null;

  // Independent writes — none depends on another's result — so they run
  // concurrently instead of paying three sequential round trips.
  const [, { token, expiresAt }] = await Promise.all([
    resetFailedLogin(user.id),
    createSession(user.id, meta),
    recordAudit({
      userId: user.id,
      role: primaryRole,
      action: "LOGIN",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }),
  ]);

  return { token, expiresAt, user };
}

export async function logout(sessionId: string, userId: string, role: string | null, meta: RequestMeta) {
  await revokeSession(sessionId);
  await recordAudit({
    userId,
    role,
    action: "LOGOUT",
    module: "auth",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Always succeeds from the caller's point of view — same constant-shaped
 * response whether or not the email belongs to an account, so this can't be
 * used to enumerate registered users. If the account exists (and isn't
 * deactivated), a single-use token is generated and the reset link is sent.
 */
export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });

  if (user && user.isActive) {
    const token = generateToken();
    storeResetToken(hashToken(token), user.id);

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      newValue: { event: "PASSWORD_RESET_REQUESTED" },
    });
  } else {
    // No matching/active account — record the attempt without a userId, same as a failed login.
    await recordAudit({
      action: "LOGIN_FAILED",
      module: "auth",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      result: "FAILURE",
      newValue: { event: "PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL", email },
    });
  }
}

export async function resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
  const userId = consumeResetToken(hashToken(token));
  if (!userId) {
    throw new AppError("This reset link is invalid or has expired. Please request a new one.", "INVALID_RESET_TOKEN", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user || !user.isActive) {
    throw new AppError("This reset link is invalid or has expired. Please request a new one.", "INVALID_RESET_TOKEN", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordResetAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  // A password reset is a strong signal the old credential may have been compromised
  // (or the user simply forgot it) — invalidate every existing session either way,
  // same as the admin-initiated deactivation path in user.service.ts.
  await revokeAllUserSessions(userId);
  invalidateResetTokensForUser(userId);

  await recordAudit({
    userId,
    action: "UPDATE",
    module: "auth",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    newValue: { event: "PASSWORD_RESET_COMPLETED" },
  });
}
