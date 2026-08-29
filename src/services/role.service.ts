import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import { ASSIGNABLE_ROLE_NAMES, type PermissionKey } from "@/config/permissions";

type ActorContext = { userId: string; role: string | null };

/** Backs every role UI surface (New User, per-row role change, Roles &
 * Permissions editor) — filtering here removes retired roles from all of
 * them at once, per the role-consolidation brief. The underlying Role rows
 * for retired roles are left in the database untouched (see ASSIGNABLE_ROLE_NAMES). */
export async function listRolesWithPermissions() {
  return prisma.role.findMany({
    where: { name: { in: [...ASSIGNABLE_ROLE_NAMES] } },
    orderBy: { label: "asc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function listPermissionCatalog() {
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] });
}

export async function setRolePermissions(roleId: string, permissionKeys: PermissionKey[], actor: ActorContext) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError("Role not found.");

  if (role.name === "SUPER_ADMIN") {
    throw new NotFoundError("Super Administrator permissions cannot be modified.");
  }

  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "PERMISSION_CHANGED",
    module: "roles",
    recordId: roleId,
    newValue: { permissions: permissionKeys },
  });

  return listRolesWithPermissions();
}
