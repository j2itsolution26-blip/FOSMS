-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GuestType" AS ENUM ('RESERVATION', 'WALK_IN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guestType" "GuestType";
