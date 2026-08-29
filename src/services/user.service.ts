import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { ASSIGNABLE_ROLE_NAMES } from "@/config/permissions";
import type { CreateUserInput, UpdateUserInput } from "@/validators/user.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = { userId: string; role: string | null };

const listInclude = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export async function listUsers(pagination: PaginationInput) {
  const { page, pageSize, search } = pagination;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { rows, meta: paginationMeta(total, { page, pageSize }) };
}

/**
 * Full account detail for the Users → View page.
 *
 * Deliberately defensive: a user's `roles` say what they're *entitled* to do,
 * but nothing in the schema guarantees a matching `Instructor`/`Trainee`
 * profile row exists (an admin can create a user with the INSTRUCTOR or
 * TRAINEE role directly from Users → New User, or change any user's role
 * from the Users table, and neither path creates the profile row — only
 * trainee.service.ts's dedicated createTrainee() does that, and only for
 * trainees). So every optional relation here — instructor, trainee, and the
 * trainee's own program/batch/instructor — is treated as genuinely optional
 * at read time, never assumed present just because a role implies it should
 * exist. The page renders "not set up" for a missing profile instead of
 * crashing on a null dereference.
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    include: {
      roles: { include: { role: true } },
      instructor: {
        include: {
          _count: { select: { trainees: true, activities: true } },
        },
      },
      trainee: {
        include: {
          program: true,
          batch: true,
          instructor: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { competencies: true, assessments: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError("User not found.");

  return user;
}

/**
 * A roleId is client-supplied, so the role it resolves to must be checked
 * against the current assignable-role allowlist server-side — never trust
 * that the UI only ever offers assignable roles. Retired roles (e.g.
 * TRAINEE, ADMINISTRATOR) still exist as rows for historical accounts, but
 * must be rejected here even if referenced directly via the API.
 */
async function assertAssignableRole(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError("Role not found.");
  if (!(ASSIGNABLE_ROLE_NAMES as readonly string[]).includes(role.name)) {
    throw new AppError("This role can no longer be assigned.", "ROLE_NOT_ASSIGNABLE", 400);
  }
  return role;
}

export async function createUser(input: CreateUserInput, actor: ActorContext) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("A user with this email already exists.", "EMAIL_TAKEN", 409);

  const role = await assertAssignableRole(input.roleId);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      roles: { create: { roleId: input.roleId } },
    },
    include: listInclude,
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "users",
    recordId: user.id,
    newValue: { email: user.email, role: role.name },
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, actor: ActorContext) {
  const existing = await prisma.user.findUnique({ where: { id, deletedAt: null }, include: listInclude });
  if (!existing) throw new NotFoundError("User not found.");

  if (input.roleId) {
    await assertAssignableRole(input.roleId);
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });

    if (input.roleId) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({ data: { userId: id, roleId: input.roleId } });
    }

    return tx.user.findUniqueOrThrow({ where: { id }, include: listInclude });
  });

  // Deactivating a user must immediately invalidate any session they're using.
  if (input.isActive === false) {
    await revokeAllUserSessions(id);
  }

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: input.isActive === false ? "UPDATE" : "ROLE_CHANGED",
    module: "users",
    recordId: id,
    previousValue: { isActive: existing.isActive, roles: existing.roles.map((r) => r.role.name) },
    newValue: input,
  });

  return user;
}
