import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, UserPlus, LogIn, LogOut, Moon, BarChart3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, type PermissionKey } from "@/config/permissions";
import { cn } from "@/lib/utils";

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: string;
  permission: PermissionKey;
};

const ACTIONS: QuickAction[] = [
  { label: "New Reservation", href: "/reservations?action=new", icon: CalendarPlus, tone: "bg-blue-50 text-blue-700", permission: PERMISSIONS.RESERVATIONS_CREATE },
  { label: "Walk-in Guest", href: "/guests?action=new", icon: UserPlus, tone: "bg-emerald-50 text-emerald-700", permission: PERMISSIONS.GUESTS_MANAGE },
  { label: "Check-in", href: "/front-office", icon: LogIn, tone: "bg-amber-50 text-amber-700", permission: PERMISSIONS.FRONT_OFFICE_VIEW },
  { label: "Check-out", href: "/front-office", icon: LogOut, tone: "bg-red-50 text-red-700", permission: PERMISSIONS.FRONT_OFFICE_VIEW },
  { label: "Night Audit", href: "/night-audit", icon: Moon, tone: "bg-violet-50 text-violet-700", permission: PERMISSIONS.NIGHT_AUDIT_VIEW },
  { label: "Reports", href: "/reports", icon: BarChart3, tone: "bg-slate-100 text-slate-700", permission: PERMISSIONS.REPORTS_VIEW },
];

export function QuickActionsCard({ permissions }: { permissions: PermissionKey[] }) {
  const allowed = new Set(permissions);
  const visible = ACTIONS.filter((a) => allowed.has(a.permission));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-center text-sm font-medium transition-colors hover:brightness-95",
                  a.tone
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {a.label}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
