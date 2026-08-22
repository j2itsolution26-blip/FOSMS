import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ConciergeClient } from "@/components/concierge/concierge-client";

export const metadata: Metadata = { title: "Concierge & Bell Service — Front Office Servicing NC II" };

export default async function ConciergePage() {
  const user = await requirePagePermission(PERMISSIONS.CONCIERGE_VIEW);
  if (!user) return <AccessDenied />;

  return <ConciergeClient canManage={hasPermission(user, PERMISSIONS.CONCIERGE_MANAGE)} />;
}
