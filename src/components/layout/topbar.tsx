"use client";

import { useState } from "react";
import { Menu, Bell, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export function Topbar({
  orgName,
  onMenuClick,
  initialNotifications,
  initialUnreadCount,
}: {
  orgName: string;
  onMenuClick: () => void;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const [now] = useState(() => new Date());
  const [notifications] = useState(initialNotifications);
  const [unreadCount] = useState(initialUnreadCount);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground sm:flex">
          <Landmark className="h-4 w-4" aria-hidden />
          <span>{orgName}</span>
        </div>

        <span className="hidden text-sm text-muted-foreground md:inline">
          {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", weekday: "long" })}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-2 py-1.5 text-sm font-semibold">Notifications</div>
            {notifications.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 whitespace-normal">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
