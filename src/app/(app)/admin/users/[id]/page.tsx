import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getUserById } from "@/services/user.service";
import { UserProfile, type UserProfileData } from "@/components/admin/user-profile";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "Account Details — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ id: string }> };

export default async function UserProfilePage({ params }: RouteParams) {
  const authUser = await requirePagePermission(PERMISSIONS.USERS_MANAGE);
  if (!authUser) return <AccessDenied />;

  const { id } = await params;

  let user;
  try {
    user = await getUserById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return <UserProfile user={JSON.parse(JSON.stringify(user)) as UserProfileData} />;
}
