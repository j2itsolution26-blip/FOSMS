import "server-only";
import { prisma } from "@/lib/prisma";
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/auth/constants";

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil > new Date();
}

/** Increments the failed-attempt counter and locks the account once the threshold is hit. */
export async function registerFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });

  if (user.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
    });
  }
}

export async function resetFailedLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}
