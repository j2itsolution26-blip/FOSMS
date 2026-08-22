import { z } from "zod";

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
  })
  .refine((data) => new Date(data.departureDate) > new Date(data.arrivalDate), {
    message: "Departure date must be after the arrival date.",
    path: ["departureDate"],
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
