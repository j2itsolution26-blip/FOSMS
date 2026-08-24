-- AlterTable
-- This migration was a no-op: the column "archivedAt" never existed in the
-- migration history (only "deletedAt" was added in 20260822073235).  The DROP
-- was applied to the live database via a manual fix but breaks the shadow
-- database.  Replaced with a conditional DROP so it succeeds in both cases.
ALTER TABLE "trainees" DROP COLUMN IF EXISTS "archivedAt";

