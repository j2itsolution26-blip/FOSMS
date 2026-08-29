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
  discountAmount: number;
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
  if (input.discountType) {
    const config = await getDiscountConfig(input.discountType);
    discountAmount = round2(subtotal * config.rate);
    vatExempt = config.vatExempt;
  }

  const vatRate = await getVatRate();
  const vatableAmount = vatExempt ? 0 : subtotal - discountAmount;
  const vatAmount = round2(vatableAmount * vatRate);

  const total = round2(subtotal - discountAmount + vatAmount);

  return {
    roomPrice,
    bedCount,
    bedCharge,
    subtotal,
    discountType: input.discountType ?? null,
    discountAmount,
    vatRate,
    vatAmount,
    total,
  };
}
