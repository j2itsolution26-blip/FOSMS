-- Additive only: no existing column/table dropped or renamed. Itemized
-- Special Requests & Additional Charges per reservation; chargeable ones are
-- billed as an ordinary cashier_transactions CHARGE (transactionId).

-- AlterEnum
ALTER TYPE "AdditionalChargeType" ADD VALUE IF NOT EXISTS 'SPECIAL_REQUEST';

-- CreateTable
CREATE TABLE IF NOT EXISTS "special_requests" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isChargeable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "transactionId" TEXT,
    "requestKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "special_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "special_requests_transactionId_key" ON "special_requests"("transactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "special_requests_requestKey_key" ON "special_requests"("requestKey");
CREATE INDEX IF NOT EXISTS "special_requests_reservationId_idx" ON "special_requests"("reservationId");

-- AddForeignKey
ALTER TABLE "special_requests" ADD CONSTRAINT "special_requests_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_requests" ADD CONSTRAINT "special_requests_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "cashier_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
