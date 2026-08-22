import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { CompetenciesList } from "@/components/competencies/competencies-list";

export const metadata: Metadata = { title: "Competencies — Front Office Servicing NC II" };

export default async function CompetenciesPage() {
  const user = await requirePagePermission(PERMISSIONS.COMPETENCIES_VIEW);
  if (!user) return <AccessDenied />;

  return <CompetenciesList canManage={hasPermission(user, PERMISSIONS.COMPETENCIES_MANAGE)} />;
}
