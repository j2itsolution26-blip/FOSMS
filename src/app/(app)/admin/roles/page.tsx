import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { RolesPermissionsEditor } from "@/components/admin/roles-permissions-editor";

export const metadata: Metadata = { title: "Roles & Permissions — Front Office Servicing NC II" };

export default async function RolesPage() {
  const user = await requirePagePermission(PERMISSIONS.ROLES_MANAGE);
  if (!user) return <AccessDenied />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
        <p className="text-sm text-muted-foreground">Configure what each role can access across the system.</p>
      </div>
      <RolesPermissionsEditor />
    </div>
  );
}
