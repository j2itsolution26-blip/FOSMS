export type GuestNameFields = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
};

/**
 * Formats a guest's full display name.
 * 
 * Rules:
 * - If Middle Name is provided (e.g. "Casido"), uses Middle Initial + period:
 *   "James" + "Casido" + "Tan" -> "James C. Tan"
 * - If Middle Name is empty/blank/null, falls back to First + Last:
 *   "James" + "" + "Tan" -> "James Tan" (no dangling period)
 * - Safely handles pre-dotted middle initial (e.g. "C." -> "James C. Tan", not "James C.. Tan")
 * - Safely handles missing/null guest objects or missing first/last names.
 */
export function formatGuestFullName(guest?: GuestNameFields | null): string {
  if (!guest) return "";

  const first = (guest.firstName || "").trim();
  const middle = (guest.middleName || "").trim();
  const last = (guest.lastName || "").trim();

  if (!middle) {
    return `${first} ${last}`.replace(/\s+/g, " ").trim();
  }

  // Extract middle initial (strip any existing period first)
  const initial = middle.replace(/\./g, "").trim()[0];
  if (!initial) {
    return `${first} ${last}`.replace(/\s+/g, " ").trim();
  }

  const middleDisplay = `${initial.toUpperCase()}.`;

  return `${first} ${middleDisplay} ${last}`.replace(/\s+/g, " ").trim();
}
