import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { applyNewPassword } from "@/services/account.service";
import { FRONT_DESK_ACCOUNTS, FRONT_DESK_EMAILS, FRONT_DESK_ROLE } from "@/config/front-desk-accounts";
import { ROLE_DISPLAY } from "@/config/role-display";
import type { ResetAccountPasswordInput } from "@/validators/account.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

export type StaffAccountStatus = "ACTIVE" | "DEACTIVATED";

export type StaffAccount = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  status: StaffAccountStatus;
  lastLoginAt: Date | null;
  isLocked: boolean;
};

const ROLE_LABEL = ROLE_DISPLAY[FRONT_DESK_ROLE].subtitle;

// Only roster accounts that still hold the Front Office Trainee role — so a
// Supervisor/Administrator account can never be listed, deactivated or have
// its password replaced through this module, whatever id is sent.
const rosterWhere = {
  email: { in: FRONT_DESK_EMAILS },
  deletedAt: null,
  roles: { some: { role: { name: FRONT_DESK_ROLE } } },
};

const accountSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  lastLoginAt: true,
  lockedUntil: true,
} as const;

function toStaffAccount(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
}): StaffAccount {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    roleLabel: ROLE_LABEL,
    status: u.isActive ? "ACTIVE" : "DEACTIVATED",
    lastLoginAt: u.lastLoginAt,
    isLocked: !!u.lockedUntil && u.lockedUntil > new Date(),
  };
}

/**
 * Front Desk A–O as they exist in the database, in roster order. Accounts
 * that haven't been provisioned yet are reported separately — never invented.
 */
export async function listStaffAccounts() {
  const users = await prisma.user.findMany({ where: rosterWhere, select: accountSelect });
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const accounts: StaffAccount[] = [];
  const missing: string[] = [];
  for (const def of FRONT_DESK_ACCOUNTS) {
    const user = byEmail.get(def.email);
    if (user) accounts.push(toStaffAccount(user));
    else missing.push(`${def.firstName} ${def.lastName}`);
  }
  return { accounts, missing };
}

async function findRosterAccount(id: string) {
  const user = await prisma.user.findFirst({ where: { id, ...rosterWhere }, select: accountSelect });
  if (!user) throw new NotFoundError("Staff account not found.");
  return user;
}

/**
 * Activate / deactivate a trainee login. Deactivating only flips `isActive`
 * and signs the account out everywhere — no guest, reservation, folio,
 * cashiering, membership or activity-log row is touched. Sign-in
 * (auth.service login) and every authenticated request (getCurrentUser)
 * already refuse an inactive account.
 */
export async function setStaffAccountStatus(id: string, status: StaffAccountStatus, actor: ActorContext) {
  if (id === actor.userId) {
    throw new AppError("You cannot change the status of your own account.", "CANNOT_CHANGE_OWN_STATUS", 400);
  }
  const existing = await findRosterAccount(id);
  const isActive = status === "ACTIVE";

  const updated = existing.isActive === isActive
    ? existing
    : await prisma.user.update({ where: { id }, data: { isActive }, select: accountSelect });

  // Always revoke on deactivate (even if already inactive) so no session
  // that slipped through can outlive the Supervisor's decision.
  if (!isActive) await revokeAllUserSessions(id);

  if (existing.isActive !== isActive) {
    await recordAudit({
      userId: actor.userId,
      role: actor.role,
      action: "UPDATE",
      module: "users",
      recordId: id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      previousValue: { status: existing.isActive ? "ACTIVE" : "DEACTIVATED" },
      newValue: {
        event: isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
        account: `${existing.firstName} ${existing.lastName}`.trim(),
        email: existing.email,
        status,
      },
    });
  }

  return toStaffAccount(updated);
}

/**
 * Supervisor-issued password for one trainee login. Only the password
 * columns change (see applyNewPassword) — a DEACTIVATED account stays
 * deactivated.
 */
export async function resetStaffAccountPassword(id: string, input: ResetAccountPasswordInput, actor: ActorContext) {
  if (id === actor.userId) {
    throw new AppError(
      "Use Account & Password to update your own account — it requires your current password.",
      "CANNOT_RESET_OWN_ACCOUNT",
      400
    );
  }
  const target = await findRosterAccount(id);

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

  return toStaffAccount(await findRosterAccount(id));
}
