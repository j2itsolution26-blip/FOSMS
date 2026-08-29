/**
 * Central permission catalog. This is the single source of truth for every
 * permission key used across API routes, server actions, and UI gating.
 * Rows are synced into the `permissions` table by prisma/seed.ts — nothing
 * about RBAC is hard-coded into components; components only ask
 * `hasPermission(user, PERMISSIONS.RESERVATIONS_CREATE)`.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  TRAINEE_PORTAL_ACCESS: "trainee-portal:access",

  RESERVATIONS_VIEW: "reservations:view",
  RESERVATIONS_CREATE: "reservations:create",
  RESERVATIONS_UPDATE: "reservations:update",
  RESERVATIONS_CANCEL: "reservations:cancel",

  GUESTS_VIEW: "guests:view",
  GUESTS_MANAGE: "guests:manage",

  ROOMS_VIEW: "rooms:view",
  ROOMS_MANAGE: "rooms:manage",

  FRONT_OFFICE_VIEW: "front-office:view",
  FRONT_OFFICE_MANAGE: "front-office:manage",
  CLUB_RECEPTION_VIEW: "club-reception:view",
  CLUB_RECEPTION_MANAGE: "club-reception:manage",
  CONCIERGE_VIEW: "concierge:view",
  CONCIERGE_MANAGE: "concierge:manage",
  CASHIERING_VIEW: "cashiering:view",
  CASHIERING_MANAGE: "cashiering:manage",
  NIGHT_AUDIT_VIEW: "night-audit:view",
  NIGHT_AUDIT_MANAGE: "night-audit:manage",

  TRAINEES_VIEW: "trainees:view",
  TRAINEES_CREATE: "trainees:create",
  TRAINEES_UPDATE: "trainees:update",
  TRAINEES_ARCHIVE: "trainees:archive",
  COMPETENCIES_VIEW: "competencies:view",
  COMPETENCIES_MANAGE: "competencies:manage",
  TRAINING_ACTIVITIES_VIEW: "training-activities:view",
  TRAINING_ACTIVITIES_MANAGE: "training-activities:manage",
  ASSESSMENTS_VIEW: "assessments:view",
  ASSESSMENTS_CREATE: "assessments:create",
  ASSESSMENTS_EVALUATE: "assessments:evaluate",
  ASSESSMENTS_FINALIZE: "assessments:finalize",
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_RECORD: "attendance:record",

  REPORTS_VIEW: "reports:view",
  REPORTS_GENERATE: "reports:generate",
  REPORTS_EXPORT: "reports:export",

  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",
  AUDIT_VIEW: "audit:view",
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type PermissionDefinition = {
  key: PermissionKey;
  module: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: PERMISSIONS.DASHBOARD_VIEW, module: "dashboard", description: "View dashboard" },
  { key: PERMISSIONS.TRAINEE_PORTAL_ACCESS, module: "trainee-portal", description: "Access the trainee self-service portal (own activities, competencies, assessments, attendance, progress, evidence)" },

  { key: PERMISSIONS.RESERVATIONS_VIEW, module: "reservations", description: "View reservations" },
  { key: PERMISSIONS.RESERVATIONS_CREATE, module: "reservations", description: "Create reservations" },
  { key: PERMISSIONS.RESERVATIONS_UPDATE, module: "reservations", description: "Edit / confirm reservations" },
  { key: PERMISSIONS.RESERVATIONS_CANCEL, module: "reservations", description: "Cancel reservations" },

  { key: PERMISSIONS.GUESTS_VIEW, module: "guests", description: "View guest records" },
  { key: PERMISSIONS.GUESTS_MANAGE, module: "guests", description: "Create / edit guest records" },

  { key: PERMISSIONS.ROOMS_VIEW, module: "rooms", description: "View rooms and room status" },
  { key: PERMISSIONS.ROOMS_MANAGE, module: "rooms", description: "Create / edit rooms and room types" },

  { key: PERMISSIONS.FRONT_OFFICE_VIEW, module: "front-office", description: "View front office operations" },
  { key: PERMISSIONS.FRONT_OFFICE_MANAGE, module: "front-office", description: "Check guests in/out, transfer rooms, verify guests" },
  { key: PERMISSIONS.CLUB_RECEPTION_VIEW, module: "club-reception", description: "View club reception records" },
  { key: PERMISSIONS.CLUB_RECEPTION_MANAGE, module: "club-reception", description: "Register members / visitors, log reception activity" },
  { key: PERMISSIONS.CONCIERGE_VIEW, module: "concierge", description: "View concierge / bell service requests" },
  { key: PERMISSIONS.CONCIERGE_MANAGE, module: "concierge", description: "Create, assign, and update service requests" },
  { key: PERMISSIONS.CASHIERING_VIEW, module: "cashiering", description: "View cashiering transactions" },
  { key: PERMISSIONS.CASHIERING_MANAGE, module: "cashiering", description: "Process payments/refunds, open/close cashier sessions" },
  { key: PERMISSIONS.NIGHT_AUDIT_VIEW, module: "night-audit", description: "Access night audit" },
  { key: PERMISSIONS.NIGHT_AUDIT_MANAGE, module: "night-audit", description: "Open, review, and finalize night audit" },

  { key: PERMISSIONS.TRAINEES_VIEW, module: "trainees", description: "View trainee records" },
  { key: PERMISSIONS.TRAINEES_CREATE, module: "trainees", description: "Enroll new trainees" },
  { key: PERMISSIONS.TRAINEES_UPDATE, module: "trainees", description: "Edit trainee records" },
  { key: PERMISSIONS.TRAINEES_ARCHIVE, module: "trainees", description: "Archive / withdraw trainees" },
  { key: PERMISSIONS.COMPETENCIES_VIEW, module: "competencies", description: "View competencies" },
  { key: PERMISSIONS.COMPETENCIES_MANAGE, module: "competencies", description: "Configure competencies" },
  { key: PERMISSIONS.TRAINING_ACTIVITIES_VIEW, module: "training-activities", description: "View training activities" },
  { key: PERMISSIONS.TRAINING_ACTIVITIES_MANAGE, module: "training-activities", description: "Create, assign, and grade training activities" },
  { key: PERMISSIONS.ASSESSMENTS_VIEW, module: "assessments", description: "View assessments" },
  { key: PERMISSIONS.ASSESSMENTS_CREATE, module: "assessments", description: "Schedule / assign assessments" },
  { key: PERMISSIONS.ASSESSMENTS_EVALUATE, module: "assessments", description: "Record evidence, observations, and submit for review" },
  { key: PERMISSIONS.ASSESSMENTS_FINALIZE, module: "assessments", description: "Review, finalize, and correct assessment results" },
  { key: PERMISSIONS.ATTENDANCE_VIEW, module: "attendance", description: "View attendance records" },
  { key: PERMISSIONS.ATTENDANCE_RECORD, module: "attendance", description: "Record trainee attendance" },

  { key: PERMISSIONS.REPORTS_VIEW, module: "reports", description: "View reports and analytics" },
  { key: PERMISSIONS.REPORTS_GENERATE, module: "reports", description: "Generate custom reports" },
  { key: PERMISSIONS.REPORTS_EXPORT, module: "reports", description: "Export reports (CSV/print)" },

  { key: PERMISSIONS.USERS_MANAGE, module: "administration", description: "Manage users" },
  { key: PERMISSIONS.ROLES_MANAGE, module: "administration", description: "Manage roles and permissions" },
  { key: PERMISSIONS.AUDIT_VIEW, module: "administration", description: "View audit logs" },
  { key: PERMISSIONS.SETTINGS_MANAGE, module: "administration", description: "Manage system settings" },
];

/** Default role -> permission grants, applied by prisma/seed.ts. Admins can change this later via Roles & Permissions. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.key),
  ADMINISTRATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_CREATE,
    PERMISSIONS.RESERVATIONS_UPDATE,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.GUESTS_MANAGE,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.ROOMS_MANAGE,
    PERMISSIONS.FRONT_OFFICE_VIEW,
    PERMISSIONS.FRONT_OFFICE_MANAGE,
    PERMISSIONS.CLUB_RECEPTION_VIEW,
    PERMISSIONS.CLUB_RECEPTION_MANAGE,
    PERMISSIONS.CONCIERGE_VIEW,
    PERMISSIONS.CONCIERGE_MANAGE,
    PERMISSIONS.CASHIERING_VIEW,
    PERMISSIONS.CASHIERING_MANAGE,
    PERMISSIONS.NIGHT_AUDIT_VIEW,
    PERMISSIONS.NIGHT_AUDIT_MANAGE,
    PERMISSIONS.TRAINEES_VIEW,
    PERMISSIONS.TRAINEES_CREATE,
    PERMISSIONS.TRAINEES_UPDATE,
    PERMISSIONS.TRAINEES_ARCHIVE,
    PERMISSIONS.COMPETENCIES_VIEW,
    PERMISSIONS.COMPETENCIES_MANAGE,
    PERMISSIONS.TRAINING_ACTIVITIES_VIEW,
    PERMISSIONS.TRAINING_ACTIVITIES_MANAGE,
    PERMISSIONS.ASSESSMENTS_VIEW,
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ASSESSMENTS_EVALUATE,
    PERMISSIONS.ASSESSMENTS_FINALIZE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  FRONT_OFFICE_STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_CREATE,
    PERMISSIONS.RESERVATIONS_UPDATE,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.GUESTS_MANAGE,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.FRONT_OFFICE_VIEW,
    PERMISSIONS.FRONT_OFFICE_MANAGE,
    PERMISSIONS.CLUB_RECEPTION_VIEW,
    PERMISSIONS.CLUB_RECEPTION_MANAGE,
    PERMISSIONS.CONCIERGE_VIEW,
    PERMISSIONS.CONCIERGE_MANAGE,
    PERMISSIONS.CASHIERING_VIEW,
    PERMISSIONS.CASHIERING_MANAGE,
    PERMISSIONS.TRAINEES_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
  ],
  /** Consolidated FOSMS operational-supervision role (replaces the former
   * ADMINISTRATOR/INSTRUCTOR/ASSESSOR/SUPER_ADMIN split). Deliberately
   * excludes ROLES_MANAGE/SETTINGS_MANAGE (system administration, not
   * operational supervision) and the hands-on hotel-ops keys — no
   * *_CREATE/_MANAGE for reservations/rooms/cashiering, which stay Front
   * Office's domain. Does hold read-only front-office visibility
   * (RESERVATIONS_VIEW/ROOMS_VIEW/GUESTS_VIEW/FRONT_OFFICE_VIEW/CONCIERGE_VIEW)
   * so a Front Office Supervisor can monitor daily operations — arrivals,
   * departures, room status, guest service requests — without being able to
   * create reservations, change room status, or process payments themselves. */
  SUPERVISOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.FRONT_OFFICE_VIEW,
    PERMISSIONS.CONCIERGE_VIEW,
    PERMISSIONS.TRAINEES_VIEW,
    PERMISSIONS.TRAINEES_CREATE,
    PERMISSIONS.TRAINEES_UPDATE,
    PERMISSIONS.TRAINEES_ARCHIVE,
    PERMISSIONS.COMPETENCIES_VIEW,
    PERMISSIONS.COMPETENCIES_MANAGE,
    PERMISSIONS.TRAINING_ACTIVITIES_VIEW,
    PERMISSIONS.TRAINING_ACTIVITIES_MANAGE,
    PERMISSIONS.ASSESSMENTS_VIEW,
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ASSESSMENTS_EVALUATE,
    PERMISSIONS.ASSESSMENTS_FINALIZE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  INSTRUCTOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TRAINEES_VIEW,
    PERMISSIONS.TRAINEES_CREATE,
    PERMISSIONS.TRAINEES_UPDATE,
    PERMISSIONS.COMPETENCIES_VIEW,
    PERMISSIONS.TRAINING_ACTIVITIES_VIEW,
    PERMISSIONS.TRAINING_ACTIVITIES_MANAGE,
    PERMISSIONS.ASSESSMENTS_VIEW,
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
  ],
  ASSESSOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TRAINEES_VIEW,
    PERMISSIONS.COMPETENCIES_VIEW,
    PERMISSIONS.ASSESSMENTS_VIEW,
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ASSESSMENTS_EVALUATE,
    PERMISSIONS.ASSESSMENTS_FINALIZE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
  ],
  TRAINEE: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.TRAINEE_PORTAL_ACCESS],
};

/**
 * The only roles a normal user (or a raw API call) may be assigned through
 * account creation/role-change. SUPER_ADMIN/ADMINISTRATOR/INSTRUCTOR/ASSESSOR/
 * TRAINEE rows still exist in the database for historical/referential
 * integrity (existing accounts, audit trail), but are no longer assignable —
 * enforced server-side in user.service.ts, not just hidden from the UI.
 */
export const ASSIGNABLE_ROLE_NAMES = ["SUPERVISOR", "FRONT_OFFICE_STAFF"] as const;
