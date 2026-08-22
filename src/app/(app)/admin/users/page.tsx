import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Users — Front Office Servicing NC II" };

export default async function UsersPage() {
  const user = await requirePagePermission(PERMISSIONS.USERS_MANAGE);
  if (!user) return <AccessDenied />;

  return <UsersTable currentUserId={user.id} />;
}
