-- AlterTable
ALTER TABLE "room_status_history" ADD COLUMN     "changedById" TEXT;

-- AddForeignKey
ALTER TABLE "room_status_history" ADD CONSTRAINT "room_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
