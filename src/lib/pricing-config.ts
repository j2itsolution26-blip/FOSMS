import "server-only";
import { prisma } from "@/lib/prisma";
import type { DiscountType } from "@prisma/client";

/**
 * Financial config lives in the generic `system_settings` table rather than
 * hardcoded constants, so VAT/discount/bed rates can be changed later via
 * Admin → System Settings without a code change. Seeded defaults are in
 * prisma/seed.ts.
 */

const VAT_RATE_KEY = "vat_rate";
const DISCOUNT_RATES_KEY = "discount_rates";
const ADDITIONAL_BED_RATE_KEY = "additional_bed_rate";

type DiscountRateConfig = { rate: number; vatExempt: boolean };
type DiscountRatesSetting = Record<DiscountType, DiscountRateConfig>;

export async function getVatRate(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: VAT_RATE_KEY } });
  const rate = (setting?.value as { rate?: number } | null)?.rate;
  return typeof rate === "number" ? rate : 0;
}

export async function getDiscountConfig(type: DiscountType): Promise<DiscountRateConfig> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: DISCOUNT_RATES_KEY } });
  const rates = setting?.value as DiscountRatesSetting | null;
  return rates?.[type] ?? { rate: 0, vatExempt: false };
}

export async function getBedRate(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: ADDITIONAL_BED_RATE_KEY } });
  const amount = (setting?.value as { amount?: number } | null)?.amount;
  return typeof amount === "number" ? amount : 0;
}

export const PRICING_SETTING_KEYS = {
  VAT_RATE: VAT_RATE_KEY,
  DISCOUNT_RATES: DISCOUNT_RATES_KEY,
  ADDITIONAL_BED_RATE: ADDITIONAL_BED_RATE_KEY,
} as const;
