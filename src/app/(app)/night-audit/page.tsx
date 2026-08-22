import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { NightAuditClient } from "@/components/night-audit/night-audit-client";

export const metadata: Metadata = { title: "Night Audit — Front Office Servicing NC II" };

export default async function NightAuditPage() {
  const user = await requirePagePermission(PERMISSIONS.NIGHT_AUDIT_VIEW);
  if (!user) return <AccessDenied />;

  return <NightAuditClient canManage={hasPermission(user, PERMISSIONS.NIGHT_AUDIT_MANAGE)} />;
}
