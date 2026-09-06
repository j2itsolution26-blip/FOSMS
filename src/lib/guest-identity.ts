/**
 * Order-independent "same person" name key — catches the same real person
 * typed as "Manny Pacquiao" vs "Pacquiao Manny" (or with extra whitespace/
 * punctuation) without needing real fuzzy matching. Lowercases, strips
 * punctuation, splits into words, and sorts them, so word order and casing
 * never affect the comparison. Not a substitute for matching by Guest ID —
 * only used to flag a likely-existing person for a human to verify (see
 * registerClubMembership in club-membership.service.ts), never to silently
 * merge or auto-select a record.
 */
export function normalizeNameKey(...parts: Array<string | null | undefined>): string {
  return parts
    .flatMap((part) => (part ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/))
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function sameNormalizedName(
  a: { firstName?: string | null; middleName?: string | null; lastName?: string | null },
  b: { firstName?: string | null; middleName?: string | null; lastName?: string | null }
): boolean {
  const keyA = normalizeNameKey(a.firstName, a.middleName, a.lastName);
  const keyB = normalizeNameKey(b.firstName, b.middleName, b.lastName);
  return !!keyA && keyA === keyB;
}
