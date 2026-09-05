-- Additive only: no existing column/table dropped or renamed. Lets Check-Out's
-- "Add Additional Charge" post a CHARGE tagged with why it was added (damage,
-- lost item, additional service, or a free-text "other"), independent of the
-- auto-created room charge which leaves these columns null.

-- CreateEnum
CREATE TYPE "AdditionalChargeType" AS ENUM ('DAMAGE', 'LOST_ITEM', 'ADDITIONAL_SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "additionalChargeType" "AdditionalChargeType";
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "otherChargeType" TEXT;
