import type { Metadata } from "next";
import { Suspense } from "react";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ReservationsTable } from "@/components/reservations/reservations-table";

export const metadata: Metadata = { title: "Reservations — Front Office Servicing NC II" };

export default async function ReservationsPage() {
  const user = await requirePagePermission(PERMISSIONS.RESERVATIONS_VIEW);
  if (!user) return <AccessDenied />;

  return (
    <Suspense>
      <ReservationsTable
        canCreate={hasPermission(user, PERMISSIONS.RESERVATIONS_CREATE)}
        canUpdate={hasPermission(user, PERMISSIONS.RESERVATIONS_UPDATE)}
        canCancel={hasPermission(user, PERMISSIONS.RESERVATIONS_CANCEL)}
      />
    </Suspense>
  );
}
