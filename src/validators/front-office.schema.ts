import { z } from "zod";

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

export const walkInSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional().or(z.literal("")),
  roomId: z.string().min(1, "Room is required."),
  nights: z.coerce.number().int().min(1).max(60).default(1),
  numGuests: z.coerce.number().int().min(1).max(20).default(1),
});
export type WalkInInput = z.infer<typeof walkInSchema>;
