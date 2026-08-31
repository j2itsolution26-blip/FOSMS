-- AlterTable
ALTER TABLE "cashier_transactions" ADD COLUMN IF NOT EXISTS "settlesTransactionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cashier_transactions_settlesTransactionId_idx" ON "cashier_transactions"("settlesTransactionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_settlesTransactionId_fkey"
    FOREIGN KEY ("settlesTransactionId") REFERENCES "cashier_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
