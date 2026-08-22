import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { FrontOfficeServicesClient } from "@/components/front-office/front-office-services-client";

export const metadata: Metadata = { title: "Front Office Services — Front Office Servicing NC II" };

export default async function FrontOfficePage() {
  const user = await requirePagePermission(PERMISSIONS.FRONT_OFFICE_VIEW);
  if (!user) return <AccessDenied />;

  return <FrontOfficeServicesClient canManage={hasPermission(user, PERMISSIONS.FRONT_OFFICE_MANAGE)} />;
}
