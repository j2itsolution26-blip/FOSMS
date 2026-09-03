import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { LaboratoryDataClient } from "@/components/admin/laboratory-data-client";

export const metadata: Metadata = { title: "Laboratory Data — Front Office Servicing NC II" };

export default async function LaboratoryDataPage() {
  const user = await requirePagePermission(PERMISSIONS.LAB_DATA_RESET);
  if (!user) return <AccessDenied />;

  return <LaboratoryDataClient />;
}
