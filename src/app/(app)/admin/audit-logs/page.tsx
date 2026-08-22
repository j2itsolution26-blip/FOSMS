import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";

export const metadata: Metadata = { title: "Audit Logs — Front Office Servicing NC II" };

export default async function AuditLogsPage() {
  const user = await requirePagePermission(PERMISSIONS.AUDIT_VIEW);
  if (!user) return <AccessDenied />;

  return <AuditLogsTable />;
}
