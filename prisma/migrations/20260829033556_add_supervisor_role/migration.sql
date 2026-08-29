-- AlterEnum
-- Adds the consolidated SUPERVISOR role. Purely additive — no existing
-- RoleName values are removed, so existing rows/FKs referencing
-- SUPER_ADMIN/ADMINISTRATOR/INSTRUCTOR/ASSESSOR/TRAINEE are unaffected.
ALTER TYPE "RoleName" ADD VALUE 'SUPERVISOR';
