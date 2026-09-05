const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  ONLINE: "Online",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Others",
};

/**
 * Formats a transaction's Mode of Payment for display. OTHER shows the
 * user-entered label appended ("Others — GCash") instead of the bare enum
 * value, everywhere the app shows a payment method (Guest Folio, Cashiering,
 * receipts, transaction details).
 */
export function formatPaymentMethod(
  method?: string | null,
  otherPaymentMethod?: string | null
): string | null {
  if (!method) return null;
  const label = PAYMENT_METHOD_LABELS[method] ?? method;
  if (method === "OTHER" && otherPaymentMethod?.trim()) {
    return `${label} — ${otherPaymentMethod.trim()}`;
  }
  return label;
}

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
  CLUB_MEMBER: "Club Member",
  OTHER: "Other",
};

/**
 * Formats a transaction's Discount Type for display. OTHER shows the
 * user-entered label appended ("Other — Employee Discount") instead of the
 * bare enum value, everywhere the app shows a discount type (Guest Folio,
 * Cashiering, receipts, transaction details, printed folio).
 */
export function formatDiscountType(type?: string | null, otherDiscountType?: string | null): string | null {
  if (!type) return null;
  const label = DISCOUNT_TYPE_LABELS[type] ?? type;
  if (type === "OTHER" && otherDiscountType?.trim()) {
    return `${label} — ${otherDiscountType.trim()}`;
  }
  return label;
}

/**
 * Formats a discount's rate for display (e.g. "2%") by deriving it from the
 * transaction's own persisted discountAmount/subtotal — never from a
 * hardcoded per-type percentage — so it always matches what was actually
 * charged, for every discount type (including future ones), without drifting
 * from src/lib/pricing-config.ts if a rate is ever changed there.
 *
 * The OTHER discount type is the one exception: its rate is whatever the
 * Front Desk Officer typed (not a configured percentage), and deriving it
 * back from discountAmount/subtotal can lose precision for a non-round rate
 * (e.g. 5.5%) once both are independently rounded to 2 decimals — so pass
 * the transaction's own otherDiscountRate through as the 3rd argument to
 * display it exactly as entered.
 */
export function formatDiscountRate(
  discountAmount?: string | number | null,
  subtotal?: string | number | null,
  otherDiscountRate?: string | number | null
): string | null {
  if (otherDiscountRate != null && otherDiscountRate !== "") {
    return `${Number(otherDiscountRate)}%`;
  }
  const amount = discountAmount != null ? Number(discountAmount) : 0;
  const base = subtotal != null ? Number(subtotal) : 0;
  if (!amount || !base) return null;
  return `${Math.round((amount / base) * 100)}%`;
}

/**
 * Formats how a reservation was created — RESERVATION (Guest Folio /
 * Reservations module) vs WALK_IN (the dedicated Walk-In Guest flow) — for
 * display anywhere Guest Type appears. Null (rows created before this field
 * existed, or with no reservation to trace back to) reads as "Unknown"
 * rather than being guessed at.
 */
export function guestTypeLabel(guestType?: "RESERVATION" | "WALK_IN" | null): string {
  if (guestType === "RESERVATION") return "Reservation";
  if (guestType === "WALK_IN") return "Walk-In";
  return "Unknown";
}

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
