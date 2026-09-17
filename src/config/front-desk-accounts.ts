/**
 * The Front Office Trainee logins a Supervisor manages from Staff / Accounts —
 * exactly Front Desk A through Front Desk O, one per class section/workstation.
 *
 * Emails are stored lowercase because sign-in lowercases what the student
 * types (see loginSchema), so "frontdeskA@fonc2s.local" and
 * "frontdeska@fonc2s.local" are the same login.
 *
 * Shared by the Staff / Accounts service (which only ever lists or changes
 * accounts on this roster) and the provisioning script / seed.
 */
export const FRONT_DESK_ROLE = "FRONT_OFFICE_STAFF" as const;

export const FRONT_DESK_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"] as const;

export type FrontDeskAccountDef = {
  letter: (typeof FRONT_DESK_LETTERS)[number];
  email: string;
  firstName: string;
  lastName: string;
};

export const FRONT_DESK_ACCOUNTS: FrontDeskAccountDef[] = FRONT_DESK_LETTERS.map((letter) => ({
  letter,
  email: `frontdesk${letter.toLowerCase()}@fonc2s.local`,
  // Displayed as "Front Desk A" (firstName + lastName), the same way every
  // other account name is rendered.
  firstName: "Front Desk",
  lastName: letter,
}));

export const FRONT_DESK_EMAILS: string[] = FRONT_DESK_ACCOUNTS.map((a) => a.email);
