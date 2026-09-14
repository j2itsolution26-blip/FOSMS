/**
 * How each role is presented to the user. The workstation is shared by
 * students practicing Front Office operations, so the UI identifies the
 * authenticated *role* rather than a (fictional) personal name.
 *
 * Single source of truth: the sidebar (sidebar-user.tsx) and the account /
 * password screen (account-management-client.tsx) both read from here, so the
 * account a Supervisor resets can never be labelled differently from the
 * account the trainee sees themselves signed in as.
 */
export type RoleDisplay = { avatar: string; name: string; subtitle: string };

export const ROLE_DISPLAY: Record<string, RoleDisplay> = {
  TRAINEE: { avatar: "TR", name: "Trainee / Candidate", subtitle: "Front Office Trainee" },
  SUPERVISOR: { avatar: "TRR", name: "Trainer / Assessor", subtitle: "Supervisor" },
  FRONT_OFFICE_STAFF: { avatar: "TR", name: "Trainee / Candidate", subtitle: "Front Office Trainee" },
  INSTRUCTOR: { avatar: "IN", name: "Instructor", subtitle: "Training Staff" },
  ASSESSOR: { avatar: "AS", name: "Assessor", subtitle: "Training Staff" },
  ADMINISTRATOR: { avatar: "AD", name: "Administrator", subtitle: "System Admin" },
  SUPER_ADMIN: { avatar: "SA", name: "Super Admin", subtitle: "System Admin" },
};

/**
 * The roles whose sign-in the sidebar presents as "Trainee / Candidate".
 * Derived from ROLE_DISPLAY rather than typed out again, so relabelling a
 * role in one place can never leave the two lists disagreeing.
 */
export const TRAINEE_CANDIDATE_DISPLAY_NAME = ROLE_DISPLAY.TRAINEE.name;
export const TRAINEE_CANDIDATE_ROLE_SUBTITLE = ROLE_DISPLAY.TRAINEE.subtitle;

export const TRAINEE_CANDIDATE_ROLES = Object.entries(ROLE_DISPLAY)
  .filter(([, display]) => display.name === TRAINEE_CANDIDATE_DISPLAY_NAME)
  .map(([role]) => role);
