-- Additive only: no existing column/table dropped or renamed. Adds smoking
-- status to rooms, a discount-type classification, and an itemized pricing
-- breakdown on cashier_transactions (all nullable — existing rows and
-- write-paths that only ever set `amount` are unaffected).

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('SENIOR_CITIZEN', 'PWD', 'STAKEHOLDER');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DISCOUNT_APPLIED';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "cashier_transactions" ADD COLUMN     "bedCharge" DECIMAL(10,2),
ADD COLUMN     "bedCount" INTEGER,
ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "roomTypeId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "vatAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "isSmoking" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
