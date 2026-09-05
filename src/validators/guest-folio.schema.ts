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
    paymentMethod: paymentMethodEnum.optional(),
    // Only meaningful (and required) when paymentMethod is OTHER — see
    // superRefine below.
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.departureDate) > new Date(data.arrivalDate), {
    message: "Departure date must be after the arrival date.",
    path: ["departureDate"],
  })
  .refine((data) => data.paymentMethod !== "OTHER" || !!data.otherPaymentMethod?.trim(), {
    message: "Please specify the payment method.",
    path: ["otherPaymentMethod"],
  });

export const createGuestFolioSchema = z.object({
  guest: guestSchema,
  room: guestFolioRoomSchema.optional(),
});

export type CreateGuestFolioInput = z.infer<typeof createGuestFolioSchema>;
