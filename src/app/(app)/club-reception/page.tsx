import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ClubReceptionClient } from "@/components/club-reception/club-reception-client";

export const metadata: Metadata = { title: "Club Reception — Front Office Servicing NC II" };

export default async function ClubReceptionPage() {
  const user = await requirePagePermission(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (!user) return <AccessDenied />;

  return <ClubReceptionClient canManage={hasPermission(user, PERMISSIONS.CLUB_RECEPTION_MANAGE)} />;
}
