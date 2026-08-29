import { z } from "zod";
import { discountTypeEnum, paymentMethodEnum } from "@/validators/cashiering.schema";

/**
 * The optional "Room Assignment" section of the Guest Folio dialog. Kept
 * separate from guestSchema (Guest model/API are untouched) — on submit the
 * dialog sequences a Guest create, then a Reservation create, then an
 * initial CashierTransaction create using these fields.
 */
const dateOnly = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date.");

export const folioRoomAssignmentSchema = z
  .object({
    roomTypeId: z.string().min(1, "Room type is required."),
    roomId: z.string().min(1, "Room is required."),
    arrivalDate: dateOnly,
    departureDate: dateOnly,
    bedCount: z.coerce.number().int().min(0).max(10),
    discountType: discountTypeEnum.optional(),
    paymentMethod: paymentMethodEnum,
  })
  .refine((data) => new Date(data.departureDate) > new Date(data.arrivalDate), {
    message: "Departure date must be after the arrival date.",
    path: ["departureDate"],
  });

export type FolioRoomAssignmentInput = z.infer<typeof folioRoomAssignmentSchema>;

// Guest Folio's Mode of Payment dropdown is deliberately a subset of the full
// PaymentMethod enum (brief asks for exactly Cash/Online/Debit Card).
export const FOLIO_PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "ONLINE", label: "Online" },
  { value: "CARD", label: "Debit Card" },
] as const;

export const FOLIO_DISCOUNT_TYPE_OPTIONS = [
  { value: "SENIOR_CITIZEN", label: "Senior Citizen" },
  { value: "PWD", label: "PWD" },
  { value: "STAKEHOLDER", label: "Stakeholder" },
] as const;
