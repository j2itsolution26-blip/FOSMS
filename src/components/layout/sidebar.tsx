"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_SECTIONS, TRAINEE_NAV_SECTIONS, SUPERVISOR_NAV_SECTIONS } from "@/config/navigation";
import type { PermissionKey } from "@/config/permissions";
import { SidebarUser } from "@/components/layout/sidebar-user";

export function Sidebar({
  permissions,
  mobileOpen,
  onNavigate,
  user,
}: {
  permissions: PermissionKey[];
  mobileOpen: boolean;
  onNavigate: () => void;
  user: { firstName: string; lastName: string; role: string };
}) {
  const pathname = usePathname();
  const allowed = new Set(permissions);
  // A trainee gets their own dedicated portal nav, never the staff/admin sidebar
  // (AGENTS.md §5, §20) — trainees hold no staff permissions by default anyway,
  // but this keeps the two navigation sets structurally separate regardless.
  // Supervisor gets a real-hotel-operations nav — SUPERVISOR still holds the
  // training permissions at the data layer, but that section has no place in
  // a Front Office Supervisor's navigation.
  const navSource =
    user.role === "TRAINEE" ? TRAINEE_NAV_SECTIONS : user.role === "SUPERVISOR" ? SUPERVISOR_NAV_SECTIONS : NAV_SECTIONS;
  const sections = navSource.map((section) => ({
    ...section,
    items: section.items.filter((item) => allowed.has(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[var(--app-sidebar-width)] min-w-[var(--app-sidebar-width)] max-w-[var(--app-sidebar-width)] flex-col overflow-x-hidden border-r border-white/10 bg-[#0b1c3f] text-slate-200 transition-transform duration-200 ease-in-out lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
          <BedDouble className="h-5 w-5" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-wide text-amber-400">FRONT OFFICE</p>
          <p className="text-[13px] font-bold tracking-wide text-amber-400">SERVICING NC II</p>
        </div>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">
        {sections.map((section, index) =>
          section.items.length === 0 ? null : (
            // Index in the key too: a config can have more than one unlabeled
            // section (e.g. a bare "Dashboard" item up top and a bare
            // "Activity Log" item at the bottom), and `label` alone collided
            // ("root" for every empty-label section) when that happened.
            <div key={`${section.label || "section"}-${index}`} className="mb-5">
              {section.label ? (
                <p className="px-3.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  {section.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-[9px] px-3.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        )}
      </nav>

      <SidebarUser role={user.role} />
    </aside>
  );
}
