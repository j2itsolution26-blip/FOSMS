import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ReceiptsTable } from "@/components/cashiering/receipts-table";

export const metadata: Metadata = { title: "Receipts — Front Office Servicing NC II" };

export default async function ReceiptsPage() {
  const user = await requirePagePermission(PERMISSIONS.CASHIERING_VIEW);
  if (!user) return <AccessDenied />;

  return <ReceiptsTable />;
}
