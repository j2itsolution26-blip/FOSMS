import { z } from "zod";

import { paymentMethodEnum } from "@/validators/cashiering.schema";

export const checkInSchema = z.object({
  reservationId: z.string().min(1, "Reservation is required."),
  keyCardStatus: z.string().trim().max(100).optional().or(z.literal("")),
  earlyCheckIn: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = z.object({
  reservationId: z.string().min(1, "Reservation is required."),
  lateCheckOut: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CheckOutInput = z.infer<typeof checkOutSchema>;

// Check-Out's "Register as Club Member" payment — the same fields as the
// Check-Out modal's existing Process Payment (Receive Payment) form, so the
// membership fee is paid with that one Mode of Payment, never a second one.
export const checkOutClubMembershipPaymentSchema = z
  .object({
    amount: z.coerce.number().positive("Amount must be greater than 0."),
    paymentMethod: paymentMethodEnum,
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
    reference: z.string().trim().max(200).optional().or(z.literal("")),
    processedBy: z
      .string()
      .trim()
      .min(1, "Front Desk Officer is required.")
      .max(150, "Front Desk Officer must be 150 characters or fewer."),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "OTHER" && !data.otherPaymentMethod?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the payment method.",
        path: ["otherPaymentMethod"],
      });
    }
  });
export type CheckOutClubMembershipPaymentInput = z.infer<typeof checkOutClubMembershipPaymentSchema>;

export const roomTransferSchema = z.object({
  reservationId: z.string().min(1, "Reservation is required."),
  newRoomId: z.string().min(1, "New room is required."),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type RoomTransferInput = z.infer<typeof roomTransferSchema>;

export const guestVerificationSchema = z.object({
  reservationId: z.string().min(1, "Reservation is required."),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type GuestVerificationInput = z.infer<typeof guestVerificationSchema>;
