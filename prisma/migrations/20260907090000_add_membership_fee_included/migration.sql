-- AlterTable: Guest Folio room CHARGEs may fold in a Club Membership fee
-- (see computeFolioCharge's membershipFee input) — this is a display/
-- breakdown value only, unrelated to the membership's own fee PAYMENT
-- transaction (clubMembershipId). Nullable, so every existing row is
-- unaffected.
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "membershipFeeIncluded" DECIMAL(10,2);
