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

/**
 * Formats a discount's rate for display (e.g. "2%") by deriving it from the
 * transaction's own persisted discountAmount/subtotal — never from a
 * hardcoded per-type percentage — so it always matches what was actually
 * charged, for every discount type (including future ones), without drifting
 * from src/lib/pricing-config.ts if a rate is ever changed there.
 */
export function formatDiscountRate(discountAmount?: string | number | null, subtotal?: string | number | null): string | null {
  const amount = discountAmount != null ? Number(discountAmount) : 0;
  const base = subtotal != null ? Number(subtotal) : 0;
  if (!amount || !base) return null;
  return `${Math.round((amount / base) * 100)}%`;
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
