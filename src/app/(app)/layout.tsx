import { getCurrentUser, redirectToLogin } from "@/lib/auth/session";
import type { PermissionKey } from "@/config/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { getUnreadNotifications } from "@/services/notification.service";

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || "Front Office Training Center";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return redirectToLogin();

  const { items, unreadCount } = await getUnreadNotifications(user.id);

  const role =
    user.roles.includes("TRAINEE") || user.permissions.has("trainee-portal:access" as PermissionKey)
      ? "TRAINEE"
      : user.roles.includes("SUPERVISOR")
      ? "SUPERVISOR"
      : user.roles[0] ?? "USER";

  return (
    <AppShell
      permissions={Array.from(user.permissions) as PermissionKey[]}
      orgName={ORG_NAME}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        role,
      }}
      initialNotifications={items.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt.toISOString(),
        isRead: n.isRead,
      }))}
      initialUnreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
