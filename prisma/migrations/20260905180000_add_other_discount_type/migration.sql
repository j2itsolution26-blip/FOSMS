-- AlterEnum
ALTER TYPE "DiscountType" ADD VALUE IF NOT EXISTS 'OTHER';

-- AlterTable
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "otherDiscountType" TEXT;
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "otherDiscountRate" DECIMAL(5,2);
