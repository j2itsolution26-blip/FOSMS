import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ClubMembersTable } from "@/components/club-reception/club-members-table";

export const metadata: Metadata = { title: "Club Members — Front Office Servicing NC II" };

export default async function ClubMembersPage() {
  const user = await requirePagePermission(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (!user) return <AccessDenied />;

  return <ClubMembersTable />;
}
