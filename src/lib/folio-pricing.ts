import "server-only";
import { prisma } from "@/lib/prisma";
import { getVatRate, getDiscountConfig, getBedRate } from "@/lib/pricing-config";
import { NotFoundError } from "@/lib/errors";
import type { DiscountType } from "@prisma/client";

export type FolioCharge = {
  roomPrice: number;
  bedCount: number;
  bedCharge: number;
  subtotal: number;
  discountType: DiscountType | null;
  otherDiscountType: string | null;
  otherDiscountRate: number | null;
  discountAmount: number;
  // One-time Club Membership registration fee folded into this charge's
  // taxable base — always present (0 when not applicable) so every consumer
  // can read it uniformly. Never added to `subtotal` itself (that stays
  // room+bed only, preserving every existing discount-rate/subtotal display
  // elsewhere) — see the comment on the `membershipFee` input below.
  membershipFee: number;
  vatRate: number;
  vatAmount: number;
  total: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Single source of truth for folio/room-charge math, used by both the Guest
 * Folio auto-charge path and Cashiering's manual transaction creation — so
 * the two never compute totals differently.
 *
 * Discount and VAT are independent line items (discountAmount is always
 * subtotal * rate), but a VAT-exempt discount (Senior Citizen/PWD, per RA
 * 9994/10754) makes the *entire* transaction VAT-exempt — vatAmount is 0,
 * not "VAT on the post-discount amount." A non-exempt discount (Stakeholder)
 * still charges VAT, computed on the subtotal net of that discount.
 */
export async function computeFolioCharge(input: {
  roomTypeId: string;
  bedCount?: number;
  discountType?: DiscountType | null;
  // Only meaningful (and required by the validators) when discountType is
  // OTHER — there's no configured rate for a custom, per-transaction discount,
  // so the cashier/front desk types the percentage directly.
  otherDiscountType?: string | null;
  otherDiscountRate?: number | null;
  // Only ever passed by the Guest Folio when "Register as Club Member" is
  // checked alongside a room — the one-time ₱1,000 fee is folded into the
  // taxable base (after discount, before VAT) so this charge's own VAT/Total
  // reflect the combined amount, per the Guest Folio's Club Membership
  // charges-summary/receipt spec. Never discounted (a membership fee is not
  // a discountable line item) and never added to `subtotal` itself.
  membershipFee?: number;
}): Promise<FolioCharge> {
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new NotFoundError("Room type not found.");

  const roomPrice = Number(roomType.baseRate);
  const bedCount = input.bedCount ?? 0;
  const bedRate = bedCount > 0 ? await getBedRate() : 0;
  const bedCharge = round2(bedRate * bedCount);
  const subtotal = round2(roomPrice + bedCharge);

  let discountAmount = 0;
  let vatExempt = false;
  if (input.discountType === "OTHER") {
    const rate = (input.otherDiscountRate ?? 0) / 100;
    discountAmount = round2(subtotal * rate);
    // No legal basis to assume VAT exemption for an arbitrary custom
    // discount — same treatment as Stakeholder.
    vatExempt = false;
  } else if (input.discountType) {
    const config = await getDiscountConfig(input.discountType);
    discountAmount = round2(subtotal * config.rate);
    vatExempt = config.vatExempt;
  }

  const membershipFee = round2(input.membershipFee ?? 0);

  const vatRate = await getVatRate();
  const vatableAmount = vatExempt ? 0 : subtotal - discountAmount + membershipFee;
  const vatAmount = round2(vatableAmount * vatRate);

  const total = round2(subtotal - discountAmount + membershipFee + vatAmount);

  return {
    roomPrice,
    bedCount,
    bedCharge,
    subtotal,
    discountType: input.discountType ?? null,
    otherDiscountType: input.discountType === "OTHER" ? input.otherDiscountType?.trim() || null : null,
    otherDiscountRate: input.discountType === "OTHER" ? input.otherDiscountRate ?? null : null,
    discountAmount,
    membershipFee,
    vatRate,
    vatAmount,
    total,
  };
}
