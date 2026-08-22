import type { Metadata } from "next";
import { Suspense } from "react";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { GuestsTable } from "@/components/guests/guests-table";

export const metadata: Metadata = { title: "Guests — Front Office Servicing NC II" };

export default async function GuestsPage() {
  const user = await requirePagePermission(PERMISSIONS.GUESTS_VIEW);
  if (!user) return <AccessDenied />;

  return (
    <Suspense>
      <GuestsTable canManage={hasPermission(user, PERMISSIONS.GUESTS_MANAGE)} />
    </Suspense>
  );
}
