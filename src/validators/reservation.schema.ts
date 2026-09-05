import { z } from "zod";
import { discountTypeEnum } from "@/validators/cashiering.schema";

export const reservationStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

export const reservationSourceEnum = z.enum([
  "WALK_IN",
  "PHONE",
  "EMAIL",
  "ONLINE",
  "TRAVEL_AGENT",
  "OTHER",
]);

const dateOnly = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date.");

export const createReservationSchema = z
  .object({
    guestId: z.string().min(1, "Guest is required."),
    roomId: z.string().min(1, "Room is required."),
    arrivalDate: dateOnly,
    departureDate: dateOnly,
    numGuests: z.coerce.number().int().min(1).max(20).default(1),
    source: reservationSourceEnum.default("WALK_IN"),
    specialRequests: z.string().trim().max(500).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    // Priced inputs for the reservation's initial Cashiering charge, created
    // atomically alongside it (see createReservation() /
    // resolveInitialReservationCharge() in reservation.service.ts). Optional
    // so a bare reservation still gets a real charge — just at the room
    // type's base rate, no beds, no discount.
    bedCount: z.coerce.number().int().min(0).max(10).optional(),
    discountType: discountTypeEnum.optional(),
    // Only meaningful (and required) when discountType is OTHER — see
    // superRefine below.
    otherDiscountType: z.string().trim().max(150).optional().or(z.literal("")),
    otherDiscountRate: z.string().trim().max(10).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.departureDate) <= new Date(data.arrivalDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Departure date must be after the arrival date.",
        path: ["departureDate"],
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

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const updateReservationSchema = z
  .object({
    roomId: z.string().min(1).optional(),
    arrivalDate: dateOnly.optional(),
    departureDate: dateOnly.optional(),
    numGuests: z.coerce.number().int().min(1).max(20).optional(),
    source: reservationSourceEnum.optional(),
    specialRequests: z.string().trim().max(500).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.arrivalDate || !data.departureDate || new Date(data.departureDate) > new Date(data.arrivalDate),
    { message: "Departure date must be after the arrival date.", path: ["departureDate"] }
  );

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

export const reservationStatusUpdateSchema = z.object({
  status: reservationStatusEnum,
});
