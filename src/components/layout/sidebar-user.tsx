"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

// Role-based identity: the workstation is shared by students practicing Front
// Office operations, so the sidebar identifies the authenticated *role*
// rather than a (fictional) personal name.
const ROLE_DISPLAY: Record<string, { avatar: string; name: string; subtitle: string }> = {
  TRAINEE: { avatar: "TR", name: "Trainee / Candidate", subtitle: "Front Office Trainee" },
  SUPERVISOR: { avatar: "TRR", name: "Trainer / Assessor", subtitle: "Supervisor" },
  FRONT_OFFICE_STAFF: { avatar: "TR", name: "Trainee / Candidate", subtitle: "Front Office Trainee" },
  INSTRUCTOR: { avatar: "IN", name: "Instructor", subtitle: "Training Staff" },
  ASSESSOR: { avatar: "AS", name: "Assessor", subtitle: "Training Staff" },
  ADMINISTRATOR: { avatar: "AD", name: "Administrator", subtitle: "System Admin" },
  SUPER_ADMIN: { avatar: "SA", name: "Super Admin", subtitle: "System Admin" },
};

export function SidebarUser({
  role,
}: {
  role: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const normalized = role?.trim().toUpperCase() || "";
  const roleKey =
    normalized === "TRAINEE" || normalized.includes("TRAINEE")
      ? "TRAINEE"
      : normalized === "SUPERVISOR" || normalized.includes("SUPERVISOR")
      ? "SUPERVISOR"
      : normalized;

  const display = ROLE_DISPLAY[roleKey] ?? {
    avatar: (role?.[0] ?? "?").toUpperCase(),
    name: roleLabel(role || "Unknown"),
    subtitle: "Front Office",
  };
  const { avatar, name: displayName, subtitle } = display;

  return (
    <div className="border-t border-white/10 px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-blue-600 text-xs font-semibold text-white">
                {avatar}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-white">
                {displayName}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                {subtitle}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem onSelect={handleLogout} disabled={loggingOut}>
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
