"use client";

import { useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { PermissionKey } from "@/config/permissions";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export function AppShell({
  permissions,
  orgName,
  user,
  initialNotifications,
  initialUnreadCount,
  children,
}: {
  permissions: PermissionKey[];
  orgName: string;
  user: { firstName: string; lastName: string; role: string };
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="print:hidden">
        <Sidebar
          permissions={permissions}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
          user={user}
        />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden print:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-[var(--app-sidebar-width)]">
        <div className="print:hidden">
          <Topbar
            orgName={orgName}
            onMenuClick={() => setMobileOpen((v) => !v)}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
          />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
