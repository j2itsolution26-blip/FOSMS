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

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function SidebarUser({
  firstName,
  lastName,
  role,
}: {
  firstName: string;
  lastName: string;
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

  // Fictional employee identities (e.g. "Angela Santos") are removed completely.
  // In this student training system, the Front Office workstation is dedicated to students
  // studying and practicing front desk operations, so visible branding is role/department based.
  const isFictionalStaff =
    (firstName?.trim().toLowerCase() === "angela" && lastName?.trim().toLowerCase() === "santos") ||
    `${firstName} ${lastName}`.toLowerCase().includes("angela");

  const isFrontOffice =
    role === "FRONT_OFFICE_STAFF" ||
    role?.toUpperCase().startsWith("FRONT_OFFICE") ||
    isFictionalStaff;

  const avatar = isFrontOffice ? "FO" : initials(firstName, lastName);
  const displayName = isFrontOffice ? "Front Office" : `${firstName} ${lastName}`.trim() || "Front Office";
  const subtitle = isFrontOffice ? "Front Desk" : roleLabel(role);

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
