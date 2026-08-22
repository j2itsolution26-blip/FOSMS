import type { Metadata } from "next";
import { Suspense } from "react";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AssessmentsTable } from "@/components/assessments/assessments-table";

export const metadata: Metadata = { title: "Assessments — Front Office Servicing NC II" };

export default async function AssessmentsPage() {
  const user = await requirePagePermission(PERMISSIONS.ASSESSMENTS_VIEW);
  if (!user) return <AccessDenied />;

  return (
    <Suspense>
      <AssessmentsTable
        canCreate={hasPermission(user, PERMISSIONS.ASSESSMENTS_CREATE)}
        canEvaluate={hasPermission(user, PERMISSIONS.ASSESSMENTS_EVALUATE)}
        canFinalize={hasPermission(user, PERMISSIONS.ASSESSMENTS_FINALIZE)}
        canExport={hasPermission(user, PERMISSIONS.REPORTS_EXPORT)}
      />
    </Suspense>
  );
}
