-- DropIndex
DROP INDEX "notifications_userId_isRead_idx";

-- AlterTable
ALTER TABLE "trainee_documents" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Training Documents',
ADD COLUMN     "description" TEXT;

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE INDEX "cashier_transactions_createdAt_idx" ON "cashier_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "cashier_transactions_type_createdAt_idx" ON "cashier_transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "check_ins_checkedInAt_idx" ON "check_ins"("checkedInAt");

-- CreateIndex
CREATE INDEX "check_outs_checkedOutAt_idx" ON "check_outs"("checkedOutAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "reservations_arrivalDate_idx" ON "reservations"("arrivalDate");

-- CreateIndex
CREATE INDEX "reservations_departureDate_idx" ON "reservations"("departureDate");

-- CreateIndex
CREATE INDEX "reservations_createdAt_idx" ON "reservations"("createdAt");

-- CreateIndex
CREATE INDEX "reservations_guestId_idx" ON "reservations"("guestId");

-- CreateIndex
CREATE INDEX "trainees_deletedAt_status_idx" ON "trainees"("deletedAt", "status");

-- CreateIndex
CREATE INDEX "trainees_batchId_idx" ON "trainees"("batchId");

-- CreateIndex
CREATE INDEX "trainees_instructorId_idx" ON "trainees"("instructorId");

-- CreateIndex
CREATE INDEX "training_activity_submissions_traineeId_status_idx" ON "training_activity_submissions"("traineeId", "status");

-- CreateIndex
CREATE INDEX "training_activity_submissions_traineeId_idx" ON "training_activity_submissions"("traineeId");

