-- Additive only: one new column on special_requests. Existing requests
-- default to PENDING; no other table or data is touched.

-- CreateEnum
CREATE TYPE "SpecialRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "special_requests" ADD COLUMN "status" "SpecialRequestStatus" NOT NULL DEFAULT 'PENDING';
