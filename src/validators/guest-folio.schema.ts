import { z } from "zod";

import { guestSchema } from "@/validators/guest.schema";
import { discountTypeEnum, paymentMethodEnum } from "@/validators/cashiering.schema";

const dateOnly = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date.");

/**
 * The Guest Folio dialog's optional "Room Assignment" section, submitted
 * together with the guest in one atomic request (see
 * createGuestFolioWithReservationAndCharge in guest.service.ts) instead of
 * as separate Reservation/CashierTransaction calls. `roomTypeId` is
 * deliberately not accepted here — the server always derives pricing from
 * the assigned room's own room type, never from a client-supplied value.
 */
export const guestFolioRoomSchema = z
  .object({
    roomId: z.string().min(1, "Room is required."),
    arrivalDate: dateOnly,
    departureDate: dateOnly,
    bedCount: z.coerce.number().int().min(0).max(10).optional(),
    discountType: discountTypeEnum.optional(),
    // Only meaningful (and required) when discountType is OTHER — see
    // superRefine below. Kept as a string (not z.coerce.number, which turns
    // an empty field into 0 — indistinguishable from "entered 0%") so
    // "left blank" can be validated as its own error.
    otherDiscountType: z.string().trim().max(150).optional().or(z.literal("")),
    otherDiscountRate: z.string().trim().max(10).optional().or(z.literal("")),
    paymentMethod: paymentMethodEnum.optional(),
    // Only meaningful (and required) when paymentMethod is OTHER — see
    // superRefine below.
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.departureDate) <= new Date(data.arrivalDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Departure date must be after the arrival date.",
        path: ["departureDate"],
      });
    }
    if (data.paymentMethod === "OTHER" && !data.otherPaymentMethod?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the payment method.",
        path: ["otherPaymentMethod"],
      });
    }
    if (data.discountType === "OTHER") {
      if (!data.otherDiscountType?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the type of discount.",
          path: ["otherDiscountType"],
        });
      }
      const rate = data.otherDiscountRate?.trim();
      if (!rate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the discount rate.",
          path: ["otherDiscountRate"],
        });
      } else if (Number.isNaN(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid discount rate between 0 and 100.",
          path: ["otherDiscountRate"],
        });
      }
    }
  });

/**
 * The Guest Folio's optional "Register as Club Member" section — the one-time
 * ₱1,000 fee's own Mode of Payment and Front Desk Officer, independent of the
 * guest's own `processedBy` and of the room charge's Mode of Payment (the
 * membership fee is its own CashierTransaction, paid immediately, unlike the
 * room charge which is money owed and settled later — see
 * createClubMembershipPayment/createInitialReservationCharge). Only
 * meaningful (and validated) when `register` is true.
 */
export const guestFolioClubMembershipSchema = z
  .object({
    register: z.boolean().default(false),
    paymentMethod: paymentMethodEnum.optional(),
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
    processedBy: z.string().trim().max(150).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.register) return;
    if (!data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a payment method for the membership fee.",
        path: ["paymentMethod"],
      });
    }
    if (data.paymentMethod === "OTHER" && !data.otherPaymentMethod?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the payment method.",
        path: ["otherPaymentMethod"],
      });
    }
    if (!data.processedBy?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Front Desk Officer is required for the membership fee.",
        path: ["processedBy"],
      });
    }
  });

/**
 * Either an existing Guest (guestId — the real identity link, so an already-
 * registered person, e.g. an existing Club Member, is reused instead of
 * being duplicated) or a brand-new person's full details. Mirrors the exact
 * same guestId/newGuest choice registerClubMembershipSchema already uses.
 */
export const createGuestFolioSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    guest: guestSchema.optional(),
    room: guestFolioRoomSchema.optional(),
    clubMembership: guestFolioClubMembershipSchema.optional(),
  })
  .refine((data) => !!data.guestId || !!data.guest, {
    message: "Select an existing guest or enter a new guest's details.",
    path: ["guest"],
  });

export type CreateGuestFolioInput = z.infer<typeof createGuestFolioSchema>;

/**
 * Walk-In Guest: the exact same guest + room-assignment fields, validation,
 * discount, and payment logic as the Guest Folio (guestSchema /
 * guestFolioRoomSchema above) — the only difference is room assignment is
 * mandatory (a walk-in is checked in immediately, so it can never be a bare
 * guest with no room) rather than the Guest Folio's optional "assign a room"
 * toggle. See createWalkInGuestFolio() in guest.service.ts.
 */
export const createWalkInGuestSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    guest: guestSchema.optional(),
    room: guestFolioRoomSchema,
  })
  .refine((data) => !!data.guestId || !!data.guest, {
    message: "Select an existing guest or enter a new guest's details.",
    path: ["guest"],
  });

export type CreateWalkInGuestInput = z.infer<typeof createWalkInGuestSchema>;
