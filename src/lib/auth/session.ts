import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { RoleName } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth/constants";
import type { PermissionKey } from "@/config/permissions";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: RoleName[];
  permissions: Set<PermissionKey>;
};

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export async function createSession(userId: string, meta: RequestMeta = {}) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

async function loadUserWithAccess(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });

  if (!user) return null;

  const roles: RoleName[] = user.roles.map((ur) => ur.role.name);
  const permissions = new Set<PermissionKey>();
  for (const userRole of user.roles) {
    for (const rp of userRole.role.permissions) {
      permissions.add(rp.permission.key as PermissionKey);
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    roles,
    permissions,
  };
}

/**
 * Validates a raw session token against the DB and returns the authorized
 * user, or null if the token is missing, expired, revoked, or the account
 * was deactivated/deleted. Memoized per-request via React `cache` so
 * multiple `getCurrentUser()` calls in one request (layout, page, API
 * helpers) only hit the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  const user = await loadUserWithAccess(session.userId);
  if (!user || !user.isActive) return null;

  return user;
});

export async function getCurrentSessionId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true },
  });
  return session?.id ?? null;
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function hasPermission(
  user: Pick<SessionUser, "permissions"> | null | undefined,
  permission: PermissionKey
): boolean {
  return !!user?.permissions.has(permission);
}

export function hasAnyPermission(
  user: Pick<SessionUser, "permissions"> | null | undefined,
  permissions: PermissionKey[]
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}
