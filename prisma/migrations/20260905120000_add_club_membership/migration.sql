-- CreateTable
CREATE TABLE IF NOT EXISTS "club_memberships" (
    "id" TEXT NOT NULL,
    "membershipNo" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "feeAmount" DECIMAL(10,2) NOT NULL,
    "registeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "club_memberships_membershipNo_key" ON "club_memberships"("membershipNo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "club_memberships_guestId_key" ON "club_memberships"("guestId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_registeredById_fkey"
    FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "clubMembershipId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cashier_transactions_clubMembershipId_idx" ON "cashier_transactions"("clubMembershipId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_clubMembershipId_fkey"
    FOREIGN KEY ("clubMembershipId") REFERENCES "club_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
