import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { StaffAccountsClient } from "@/components/admin/staff-accounts-client";

export const metadata: Metadata = { title: "Staff / Accounts — Front Office Servicing NC II" };

export default async function StaffAccountsPage() {
  // Supervisor-only (users:manage) — a Front Office Trainee never holds it.
  // Every /api/staff-accounts route re-checks the same permission.
  const user = await requirePagePermission(PERMISSIONS.USERS_MANAGE);
  if (!user) return <AccessDenied />;

  return <StaffAccountsClient />;
}
