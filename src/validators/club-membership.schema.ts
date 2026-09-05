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
 * guestId/newGuest must be supplied — see the refine below.
 */
export const registerClubMembershipSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    newGuest: z
      .object({
        firstName: z.string().trim().min(1, "First name is required.").max(100),
        middleName: z.string().trim().max(100).optional().or(z.literal("")),
        lastName: z.string().trim().min(1, "Last name is required.").max(100),
      })
      .optional(),
    paymentMethod: paymentMethodEnum,
    // Only meaningful (and required) when paymentMethod is OTHER.
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
    // The membership payment's own Front Desk Officer — independent of (never
    // copied from) any existing Guest.processedBy.
    processedBy: cashieringProcessedBy,
  })
  .refine((data) => !!data.guestId || !!data.newGuest, {
    message: "Select an existing guest or enter a new member's name.",
    path: ["guestId"],
  })
  .refine((data) => data.paymentMethod !== "OTHER" || !!data.otherPaymentMethod?.trim(), {
    message: "Please specify the payment method.",
    path: ["otherPaymentMethod"],
  });

export type RegisterClubMembershipInput = z.infer<typeof registerClubMembershipSchema>;
