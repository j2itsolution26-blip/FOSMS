import { z } from "zod";

export const transactionTypeEnum = z.enum(["CHARGE", "PAYMENT", "DISCOUNT"]);
export const paymentMethodEnum = z.enum(["CASH", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"]);
export const discountTypeEnum = z.enum(["SENIOR_CITIZEN", "PWD", "STAKEHOLDER"]);

// A "receipt" is a PAYMENT or REFUND transaction. PAID = payment not (yet) reversed;
// REFUNDED = payment that was reversed; REFUND_ISSUED = the reversal transaction itself.
export const receiptStatusEnum = z.enum(["PAID", "REFUNDED", "REFUND_ISSUED"]);
export type ReceiptStatus = z.infer<typeof receiptStatusEnum>;

export const createTransactionSchema = z
  .object({
    reservationId: z.string().min(1, "Reservation is required."),
    type: transactionTypeEnum,
    amount: z.coerce.number().positive("Amount must be greater than 0."),
    paymentMethod: paymentMethodEnum.optional(),
    reference: z.string().trim().max(200).optional().or(z.literal("")),
    // Folio pricing breakdown — all optional so a plain charge/payment with no
    // room context behaves exactly as before. When roomTypeId is present, the
    // server recomputes `amount` from these via computeFolioCharge() rather
    // than trusting the client-supplied amount for that portion.
    roomTypeId: z.string().min(1).optional(),
    bedCount: z.coerce.number().int().min(0).max(10).optional(),
    discountType: discountTypeEnum.optional(),
  })
  // A PAYMENT records money actually received, so how it was received must
  // be captured — CHARGE/DISCOUNT don't move money, so they don't need one.
  .superRefine((data, ctx) => {
    if (data.type === "PAYMENT" && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a payment method.",
        path: ["paymentMethod"],
      });
    }
  });
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const issueRefundSchema = z.object({
  originalTransactionId: z.string().min(1, "Original transaction is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
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
