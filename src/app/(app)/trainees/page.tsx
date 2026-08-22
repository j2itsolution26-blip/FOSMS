import type { Metadata } from "next";
import { Suspense } from "react";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { TraineesTable } from "@/components/trainees/trainees-table";

export const metadata: Metadata = { title: "Trainees — Front Office Servicing NC II" };

export default async function TraineesPage() {
  const user = await requirePagePermission(PERMISSIONS.TRAINEES_VIEW);
  if (!user) return <AccessDenied />;

  return (
    <Suspense>
      <TraineesTable canCreate={hasPermission(user, PERMISSIONS.TRAINEES_CREATE)} />
    </Suspense>
  );
}
