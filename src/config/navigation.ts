import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  BedDouble,
  ConciergeBell,
  Sparkles,
  Wallet,
  Moon,
  GraduationCap,
  BookMarked,
  ClipboardList,
  FileCheck2,
  CalendarClock,
  BarChart3,
  UserCog,
  ShieldCheck,
  ScrollText,
  Settings,
  TrendingUp,
  Award,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";

import { PERMISSIONS, type PermissionKey } from "@/config/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Reservations", href: "/reservations", icon: CalendarCheck, permission: PERMISSIONS.RESERVATIONS_VIEW },
      { label: "Guests", href: "/guests", icon: Users, permission: PERMISSIONS.GUESTS_VIEW },
      { label: "Room Management", href: "/rooms", icon: BedDouble, permission: PERMISSIONS.ROOMS_VIEW },
      { label: "Front Office Services", href: "/front-office", icon: ConciergeBell, permission: PERMISSIONS.FRONT_OFFICE_VIEW },
      { label: "Club Reception", href: "/club-reception", icon: Sparkles, permission: PERMISSIONS.CLUB_RECEPTION_VIEW },
      { label: "Cashiering", href: "/cashiering", icon: Wallet, permission: PERMISSIONS.CASHIERING_VIEW },
      { label: "Night Audit", href: "/night-audit", icon: Moon, permission: PERMISSIONS.NIGHT_AUDIT_VIEW },
    ],
  },
  {
    label: "Training",
    items: [
      { label: "Trainees", href: "/trainees", icon: GraduationCap, permission: PERMISSIONS.TRAINEES_VIEW },
      { label: "Competencies", href: "/competencies", icon: BookMarked, permission: PERMISSIONS.COMPETENCIES_VIEW },
      { label: "Training Activities", href: "/training-activities", icon: ClipboardList, permission: PERMISSIONS.TRAINING_ACTIVITIES_VIEW },
      { label: "Assessments", href: "/assessments", icon: FileCheck2, permission: PERMISSIONS.ASSESSMENTS_VIEW },
      { label: "Attendance", href: "/attendance", icon: CalendarClock, permission: PERMISSIONS.ATTENDANCE_VIEW },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports & Analytics", href: "/reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog, permission: PERMISSIONS.USERS_MANAGE },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, permission: PERMISSIONS.ROLES_MANAGE },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
      { label: "System Settings", href: "/admin/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
];

/** Dedicated nav for TRAINEE-only users — never mixed with the staff/admin sidebar (AGENTS.md §5, §20). */
export const TRAINEE_NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS }],
  },
  {
    label: "My Training",
    items: [
      { label: "My Activities", href: "/my-activities", icon: ClipboardList, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
      { label: "My Competencies", href: "/my-competencies", icon: BookMarked, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
      { label: "My Assessments", href: "/my-assessments", icon: FileCheck2, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
      { label: "My Attendance", href: "/my-attendance", icon: CalendarClock, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
    ],
  },
  {
    label: "My Records",
    items: [
      { label: "Training Progress", href: "/my-progress", icon: TrendingUp, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
      { label: "Assessment Results", href: "/my-assessments", icon: Award, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
      { label: "Evidence & Documents", href: "/my-evidence", icon: FolderOpen, permission: PERMISSIONS.TRAINEE_PORTAL_ACCESS },
    ],
  },
];

/**
 * Dedicated nav for the Front Office Supervisor role — a real hotel-operations
 * view, deliberately excluding the Training section even though SUPERVISOR
 * still holds those permissions at the data layer (see permissions.ts). Every
 * link below points at a page that actually exists; items like "Guest
 * Folios," "Staff Overview/Attendance/Shift Schedule," and separate
 * per-topic reports were left out rather than linked to something that
 * doesn't exist yet — no roadmap placeholders in an accessible nav.
 */
export const SUPERVISOR_NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    label: "Operations",
    items: [
      { label: "Reservations", href: "/reservations", icon: CalendarCheck, permission: PERMISSIONS.RESERVATIONS_VIEW },
      { label: "Front Office Services", href: "/front-office", icon: ConciergeBell, permission: PERMISSIONS.FRONT_OFFICE_VIEW },
      { label: "Room Status", href: "/rooms", icon: BedDouble, permission: PERMISSIONS.ROOMS_VIEW },
    ],
  },
  {
    label: "Guests",
    items: [
      { label: "Guest Directory", href: "/guests", icon: Users, permission: PERMISSIONS.GUESTS_VIEW },
      { label: "Guest Issues", href: "/concierge", icon: AlertTriangle, permission: PERMISSIONS.CONCIERGE_VIEW },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reports & Analytics", href: "/reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW }],
  },
  {
    label: "",
    items: [{ label: "Activity Log", href: "/admin/audit-logs", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW }],
  },
];
