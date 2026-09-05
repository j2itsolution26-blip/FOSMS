import { z } from "zod";

import { paymentMethodEnum } from "@/validators/cashiering.schema";

// One-time Club Membership fee — a fixed program price, not something a
// front-desk officer can override per registration.
export const CLUB_MEMBERSHIP_FEE = 1000;

const cashieringProcessedBy = z
  .string()
  .trim()
  .min(1, "Front Desk Officer is required.")
  .max(150, "Front Desk Officer must be 150 characters or fewer.");

/**
 * Registers a Club Membership for either an existing Guest (guestId — the
 * real identity link, never a name match) or a brand-new person (newGuest),
 * plus the ₱1,000 membership fee's Mode of Payment. Exactly one of
 * guestId/newGuest is actually used — which one is driven by the dialog's
 * "this is a new person" checkbox, not by which fields happen to be
 * non-empty — so both keys are always present in the client's raw form
 * state (the inactive one holding its blank default) and only reshaped down
 * to a single populated key inside the dialog's onSubmit before it's sent to
 * the server. That means every field here must tolerate being blank/absent
 * on its own; the superRefine below is what actually enforces "guestId OR a
 * real new-guest name," using blank-or-not (not object-presence) to tell
 * which side is in play. Field-level `.min(1)` on guestId/newGuest's name
 * fields would fail validation against the inactive side's own blank
 * default and block the form from ever submitting in EITHER mode — see the
 * regression this schema previously caused (guestId defaults to "", not
 * undefined, which fails a plain `.optional()` string's min-length check).
 */
export const registerClubMembershipSchema = z
  .object({
    guestId: z.string().trim().max(200).optional().or(z.literal("")),
    newGuest: z
      .object({
        firstName: z.string().trim().max(100).optional().or(z.literal("")),
        middleName: z.string().trim().max(100).optional().or(z.literal("")),
        lastName: z.string().trim().max(100).optional().or(z.literal("")),
      })
      .optional(),
    paymentMethod: paymentMethodEnum,
    // Only meaningful (and required) when paymentMethod is OTHER.
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
    // The membership payment's own Front Desk Officer — independent of (never
    // copied from) any existing Guest.processedBy.
    processedBy: cashieringProcessedBy,
  })
  .superRefine((data, ctx) => {
    const hasGuestId = !!data.guestId?.trim();
    const hasNewGuestName = !!data.newGuest?.firstName?.trim() && !!data.newGuest?.lastName?.trim();

    if (!hasGuestId && !hasNewGuestName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an existing guest or enter a new member's name.",
        path: ["guestId"],
      });
      if (data.newGuest && !data.newGuest.firstName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First name is required.", path: ["newGuest", "firstName"] });
      }
      if (data.newGuest && !data.newGuest.lastName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Last name is required.", path: ["newGuest", "lastName"] });
      }
    }

    if (data.paymentMethod === "OTHER" && !data.otherPaymentMethod?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the payment method.",
        path: ["otherPaymentMethod"],
      });
    }
  });

export type RegisterClubMembershipInput = z.infer<typeof registerClubMembershipSchema>;
