-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('PENDING', 'COMPETENT', 'NOT_YET_COMPETENT');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PRACTICAL_DEMONSTRATION', 'OBSERVATION', 'WRITTEN_WORK', 'SIMULATION', 'PERFORMANCE_EVIDENCE', 'DOCUMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "AssessmentStatus_new" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."assessments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "assessments" ALTER COLUMN "status" TYPE "AssessmentStatus_new" USING ("status"::text::"AssessmentStatus_new");
ALTER TYPE "AssessmentStatus" RENAME TO "AssessmentStatus_old";
ALTER TYPE "AssessmentStatus_new" RENAME TO "AssessmentStatus";
DROP TYPE "public"."AssessmentStatus_old";
ALTER TABLE "assessments" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE 'EVIDENCE_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_EXPORTED';

-- AlterEnum
ALTER TYPE "TraineeStatus" ADD VALUE 'ON_HOLD';

-- DropForeignKey
ALTER TABLE "assessments" DROP CONSTRAINT "assessments_assessorId_fkey";

-- AlterTable
ALTER TABLE "assessments" DROP COLUMN "evidenceNotes",
ADD COLUMN     "assessmentNo" TEXT NOT NULL,
ADD COLUMN     "correctionOfId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "finalizedById" TEXT,
ADD COLUMN     "result" "AssessmentResult" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "scheduledDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "assessment_evidence" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "storedName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainee_documents" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_evidence_assessmentId_idx" ON "assessment_evidence"("assessmentId");

-- CreateIndex
CREATE INDEX "trainee_documents_traineeId_idx" ON "trainee_documents"("traineeId");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_assessmentNo_key" ON "assessments"("assessmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_correctionOfId_key" ON "assessments"("correctionOfId");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_assessorId_idx" ON "assessments"("assessorId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_documents" ADD CONSTRAINT "trainee_documents_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "trainees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_documents" ADD CONSTRAINT "trainee_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

