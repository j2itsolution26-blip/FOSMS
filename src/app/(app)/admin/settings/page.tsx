import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata: Metadata = { title: "System Settings — Front Office Servicing NC II" };

export default async function SettingsPage() {
  const user = await requirePagePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!user) return <AccessDenied />;

  return <SettingsClient />;
}
