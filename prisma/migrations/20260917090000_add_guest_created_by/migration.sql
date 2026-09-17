-- Additive only. Records which Front Office account created each guest, so
-- each trainee account (Front Desk A–O) only sees its own guests.

-- AlterTable
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "guests_createdById_idx" ON "guests"("createdById");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ownership for existing guests from data the system already
-- recorded (no guest data itself is changed), most reliable source first:
-- 1. the audit entry written when the guest was created;
UPDATE "guests" g
SET "createdById" = a."userId"
FROM (
  SELECT DISTINCT ON ("recordId") "recordId", "userId"
  FROM "audit_logs"
  WHERE "module" = 'guests' AND "action" = 'CREATE' AND "userId" IS NOT NULL
  ORDER BY "recordId", "createdAt" ASC
) a
WHERE g."createdById" IS NULL AND a."recordId" = g."id"
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = a."userId");

-- 2. the account that created the guest's first reservation;
UPDATE "guests" g
SET "createdById" = r."createdById"
FROM (
  SELECT DISTINCT ON ("guestId") "guestId", "createdById"
  FROM "reservations"
  ORDER BY "guestId", "createdAt" ASC
) r
WHERE g."createdById" IS NULL AND r."guestId" = g."id";

-- 3. the account that registered the guest's club membership.
UPDATE "guests" g
SET "createdById" = m."registeredById"
FROM "club_memberships" m
WHERE g."createdById" IS NULL AND m."guestId" = g."id" AND m."registeredById" IS NOT NULL;
