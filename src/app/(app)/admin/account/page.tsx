import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AccountManagementClient } from "@/components/admin/account-management-client";

export const metadata: Metadata = { title: "Account & Password — Front Office Servicing NC II" };

export default async function AccountManagementPage() {
  // Same permission the Users administration page uses — held by Supervisor
  // (and the admin roles above it), never by a trainee. Each API route this
  // page calls re-checks authorization on its own; this gate only decides
  // who can see the screen.
  const user = await requirePagePermission(PERMISSIONS.USERS_MANAGE);
  if (!user) return <AccessDenied />;

  return (
    <AccountManagementClient
      currentUser={{ name: `${user.firstName} ${user.lastName}`, email: user.email }}
    />
  );
}
