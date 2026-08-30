import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { CashieringClient } from "@/components/cashiering/cashiering-client";

export const metadata: Metadata = { title: "Cashiering — Front Office Servicing NC II" };

export default async function CashieringPage() {
  const user = await requirePagePermission(PERMISSIONS.CASHIERING_VIEW);
  if (!user) return <AccessDenied />;

  return (
    <CashieringClient
      canManage={hasPermission(user, PERMISSIONS.CASHIERING_MANAGE)}
      canViewReservations={hasPermission(user, PERMISSIONS.RESERVATIONS_VIEW)}
      canViewGuests={hasPermission(user, PERMISSIONS.GUESTS_VIEW)}
      canViewRooms={hasPermission(user, PERMISSIONS.ROOMS_VIEW)}
    />
  );
}
