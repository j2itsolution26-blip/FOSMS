const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calendar-day index of a stay date. Date-only strings ("YYYY-MM-DD", what the
 * date inputs submit) are read from their own digits, and Date values from
 * their UTC parts (how `new Date("YYYY-MM-DD")` stores them) — so a stay's
 * length never shifts with the browser/server timezone or a DST change.
 */
function dayIndex(value: string | Date): number | null {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY;
    value = new Date(value);
  }
  const time = value.getTime();
  if (Number.isNaN(time)) return null;
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / MS_PER_DAY;
}

/**
 * Number of Nights = Departure Date − Arrival Date, in whole calendar days.
 * The departure day itself is never a night (09/16 → 09/17 is 1 night,
 * 09/16 → 09/19 is 3). Same-day or reversed/invalid dates give 0 — callers
 * that persist a room charge must reject a stay with fewer than 1 night.
 */
export function calculateNights(arrivalDate: string | Date, departureDate: string | Date): number {
  const arrival = dayIndex(arrivalDate);
  const departure = dayIndex(departureDate);
  if (arrival === null || departure === null) return 0;
  return Math.max(0, Math.round(departure - arrival));
}
