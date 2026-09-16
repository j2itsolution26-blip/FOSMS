import { z } from "zod";

export const SPECIAL_REQUEST_MAX_ITEMS = 50;

/**
 * One Special Request / Additional Charge entry. A chargeable entry needs a
 * unit price above ₱0 (its total is always quantity × unit price, computed
 * server-side — never trusted from the client); a non-chargeable one is an
 * operational instruction only and carries no price.
 */
export const specialRequestItemSchema = z
  .object({
    // Client-generated once per entry — makes a retried save idempotent.
    requestKey: z.string().trim().min(8).max(64).optional(),
    itemName: z
      .string()
      .trim()
      .min(1, "Request / item name is required.")
      .max(150, "Request / item name must be 150 characters or fewer."),
    quantity: z.coerce
      .number({ message: "Enter a quantity." })
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1.")
      .max(999, "Quantity must be 999 or fewer."),
    unitPrice: z.coerce
      .number({ message: "Enter a unit price." })
      .min(0, "Unit price cannot be negative.")
      .max(1_000_000, "Unit price is too large."),
    isChargeable: z.boolean(),
    notes: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.isChargeable && !(data.unitPrice > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A chargeable request needs a unit price greater than ₱0.00.",
        path: ["unitPrice"],
      });
    }
    if (data.isChargeable && Math.round(data.unitPrice * 100) !== data.unitPrice * 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit price can have at most 2 decimal places.",
        path: ["unitPrice"],
      });
    }
  });

export type SpecialRequestItemInput = z.infer<typeof specialRequestItemSchema>;

export const specialRequestItemsSchema = z
  .array(specialRequestItemSchema)
  .max(SPECIAL_REQUEST_MAX_ITEMS, `Add at most ${SPECIAL_REQUEST_MAX_ITEMS} special requests at a time.`);

export const addSpecialRequestsSchema = z.object({
  items: specialRequestItemsSchema.min(1, "Add at least one special request."),
});
