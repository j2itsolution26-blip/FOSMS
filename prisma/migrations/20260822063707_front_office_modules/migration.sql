-- CreateEnum
CREATE TYPE "ServiceRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'CHECK_IN', 'CHECK_OUT', 'ROOM_TRANSFER', 'GUEST_VERIFICATION', 'WALK_IN', 'CLUB_REGISTRATION', 'CLUB_CHECK_OUT', 'SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_ASSIGNED', 'SERVICE_REQUEST_COMPLETED', 'PAYMENT_RECEIVED', 'REFUND_CREATED', 'CASHIER_OPENED', 'CASHIER_CLOSED', 'ASSESSMENT_FINALIZED', 'NIGHT_AUDIT_FINALIZED', 'ROLE_CHANGED', 'PERMISSION_CHANGED');
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- AlterTable
ALTER TABLE "club_receptions" ADD COLUMN     "registeredById" TEXT;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "requestNo" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "number_sequences" (
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("kind","year")
);

-- CreateIndex
CREATE INDEX "club_receptions_checkedInAt_idx" ON "club_receptions"("checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_requestNo_key" ON "service_requests"("requestNo");

-- CreateIndex
CREATE INDEX "service_requests_createdAt_idx" ON "service_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "club_receptions" ADD CONSTRAINT "club_receptions_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

