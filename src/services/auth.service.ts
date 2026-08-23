import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession } from "@/lib/auth/session";
import { isLocked, registerFailedLogin, resetFailedLogin } from "@/lib/auth/lockout";
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
