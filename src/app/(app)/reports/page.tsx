import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const metadata: Metadata = { title: "Reports & Analytics — Front Office Servicing NC II" };

export default async function ReportsPage() {
  const user = await requirePagePermission(PERMISSIONS.REPORTS_VIEW);
  if (!user) return <AccessDenied />;

  return <AnalyticsDashboard canExport={hasPermission(user, PERMISSIONS.REPORTS_EXPORT)} />;
}
