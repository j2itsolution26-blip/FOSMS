import { z } from "zod";

export const transactionTypeEnum = z.enum(["CHARGE", "PAYMENT", "DISCOUNT"]);
export const paymentMethodEnum = z.enum(["CASH", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"]);
export const discountTypeEnum = z.enum(["SENIOR_CITIZEN", "PWD", "STAKEHOLDER", "CLUB_MEMBER", "OTHER"]);
export const additionalChargeTypeEnum = z.enum(["DAMAGE", "LOST_ITEM", "ADDITIONAL_SERVICE", "OTHER"]);

// The Cashiering transaction's own "Front Desk Officer" (stored as `processedBy`
// — display label only, see prisma schema comment on
// CashierTransaction.processedBy) — a name the cashier manually types on the
// form, never the logged-in user and never the Guest Folio's own
// `processedBy` ("Front Desk Officer").
const cashieringProcessedBy = z
  .string()
  .trim()
  .min(1, "Front Desk Officer is required.")
  .max(150, "Front Desk Officer must be 150 characters or fewer.");

// A "receipt" is a PAYMENT or REFUND transaction. PAID = payment not (yet) reversed;
// REFUNDED = payment that was reversed; REFUND_ISSUED = the reversal transaction itself.
export const receiptStatusEnum = z.enum(["PAID", "REFUNDED", "REFUND_ISSUED"]);
export type ReceiptStatus = z.infer<typeof receiptStatusEnum>;

export const createTransactionSchema = z
  .object({
    reservationId: z.string().min(1, "Reservation is required."),
    type: transactionTypeEnum,
    // When roomTypeId is set, the server recomputes amount from
    // computeFolioCharge() and never trusts this value (see
    // createTransaction()) — so it only needs to be non-negative here. A
    // 100%-discounted, VAT-exempt folio charge can legitimately total 0,
    // and rejecting that would silently break the Guest Folio auto-charge.
    // Without roomTypeId (manual Cashiering entries), the amount IS what
    // gets persisted, so it must be positive.
    amount: z.coerce.number().min(0, "Amount cannot be negative."),
    paymentMethod: paymentMethodEnum.optional(),
    // Only meaningful (and required) when paymentMethod is OTHER — see
    // superRefine below.
    otherPaymentMethod: z.string().trim().max(150).optional().or(z.literal("")),
    reference: z.string().trim().max(200).optional().or(z.literal("")),
    // Folio pricing breakdown — all optional so a plain charge/payment with no
    // room context behaves exactly as before. When roomTypeId is present, the
    // server recomputes `amount` from these via computeFolioCharge() rather
    // than trusting the client-supplied amount for that portion.
    roomTypeId: z.string().min(1).optional(),
    bedCount: z.coerce.number().int().min(0).max(10).optional(),
    discountType: discountTypeEnum.optional(),
    // Only meaningful (and required) when discountType is OTHER — see
    // superRefine below. Kept as a string (not z.coerce.number, which turns
    // an empty field into 0 — indistinguishable from "entered 0%") so
    // "left blank" can be validated as its own error.
    otherDiscountType: z.string().trim().max(150).optional().or(z.literal("")),
    otherDiscountRate: z.string().trim().max(10).optional().or(z.literal("")),
    // Only set by Check-Out's "Add Additional Charge" (damage, lost item,
    // additional service, or a free-text "other") — absent on the
    // auto-created room charge and on an ordinary manual Cashiering charge.
    // See superRefine below for when reference/otherChargeType become required.
    additionalChargeType: additionalChargeTypeEnum.optional(),
    otherChargeType: z.string().trim().max(150).optional().or(z.literal("")),
    // Only required for a PAYMENT (money actually being received needs an
    // accountable name). A CHARGE — including the one auto-created when a
    // Guest Folio is saved with a room assigned — starts with no processor;
    // it's only set once the cashier completes the payment (see
    // payTransaction()/payTransactionSchema, which always require it).
    processedBy: cashieringProcessedBy.optional().or(z.literal("")),
  })
  // A PAYMENT records money actually received, so how it was received must
  // be captured — CHARGE/DISCOUNT don't move money, so they don't need one.
  .superRefine((data, ctx) => {
    if (!data.roomTypeId && data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be greater than 0.",
        path: ["amount"],
      });
    }
    if (data.type === "PAYMENT" && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a payment method.",
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
    if (data.type === "PAYMENT" && !data.processedBy?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Front Desk Officer is required.",
        path: ["processedBy"],
      });
    }
    // Check-Out's Add Additional Charge always describes what the charge is
    // for, and "Other" always names the actual charge type.
    if (data.additionalChargeType && !data.reference?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description is required.",
        path: ["reference"],
      });
    }
    if (data.additionalChargeType === "OTHER" && !data.otherChargeType?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the charge type.",
        path: ["otherChargeType"],
      });
    }
  });
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const payTransactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  processedBy: cashieringProcessedBy,
});
export type PayTransactionInput = z.infer<typeof payTransactionSchema>;

export const issueRefundSchema = z.object({
  originalTransactionId: z.string().min(1, "Original transaction is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  processedBy: cashieringProcessedBy,
});
export type IssueRefundInput = z.infer<typeof issueRefundSchema>;

export const openCashierSchema = z.object({
  openingCash: z.coerce.number().min(0, "Opening cash cannot be negative."),
});
export type OpenCashierInput = z.infer<typeof openCashierSchema>;

export const closeCashierSchema = z.object({
  closingCash: z.coerce.number().min(0, "Closing cash cannot be negative."),
});
export type CloseCashierInput = z.infer<typeof closeCashierSchema>;
