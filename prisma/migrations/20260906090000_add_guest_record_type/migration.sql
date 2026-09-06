-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GuestRecordType" AS ENUM ('REGULAR', 'MEMBERSHIP_ONLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: every existing Guest defaults to REGULAR (safe for existing data).
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "guestType" "GuestRecordType" NOT NULL DEFAULT 'REGULAR';

-- Retroactive classification: a genuinely membership-only existing Guest is
-- one that (a) has a Club Membership and (b) has never had a single
-- Reservation — i.e. never had a separate guest/folio purpose of their own.
-- A guest who happens to have a membership AND a reservation/folio history
-- is left as REGULAR, exactly as required (never auto-classify a legitimate
-- guest as membership-only).
UPDATE "guests" g
SET "guestType" = 'MEMBERSHIP_ONLY'
WHERE EXISTS (SELECT 1 FROM "club_memberships" cm WHERE cm."guestId" = g."id")
  AND NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."guestId" = g."id");
