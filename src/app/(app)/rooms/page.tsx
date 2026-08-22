import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { RoomsBoard } from "@/components/rooms/rooms-board";

export const metadata: Metadata = { title: "Room Management — Front Office Servicing NC II" };

export default async function RoomsPage() {
  const user = await requirePagePermission(PERMISSIONS.ROOMS_VIEW);
  if (!user) return <AccessDenied />;

  return <RoomsBoard canManage={hasPermission(user, PERMISSIONS.ROOMS_MANAGE)} />;
}
