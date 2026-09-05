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
    // Only meaningful (and required) when discountType is OTHER — see
    // superRefine below. Kept as a string (not z.coerce.number, which turns
    // an empty field into 0 — indistinguishable from "entered 0%") so
    // "left blank" can be validated as its own error.
    otherDiscountType: z.string().trim().max(150).optional().or(z.literal("")),
    otherDiscountRate: z.string().trim().max(10).optional().or(z.literal("")),
    paymentMethod: paymentMethodEnum,
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

export type FolioRoomAssignmentInput = z.infer<typeof folioRoomAssignmentSchema>;

// Guest Folio's Mode of Payment dropdown is deliberately a subset of the full
// PaymentMethod enum (brief asks for exactly Cash/Online/Card/Others).
export const FOLIO_PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "ONLINE", label: "Online" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Others" },
] as const;

export const FOLIO_DISCOUNT_TYPE_OPTIONS = [
  { value: "SENIOR_CITIZEN", label: "Senior Citizen" },
  { value: "PWD", label: "PWD" },
  { value: "STAKEHOLDER", label: "Stakeholder" },
  { value: "CLUB_MEMBER", label: "Club Member" },
  { value: "OTHER", label: "Other" },
] as const;
