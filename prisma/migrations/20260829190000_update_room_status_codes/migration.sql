-- AlterEnum
-- Replaces the generic 6-value RoomStatus enum with the standardized 29-code
-- front-office vocabulary (see src/config/room-status.ts for labels/descriptions).
-- Every existing "rooms" / "room_status_history" row is remapped, not dropped:
--   AVAILABLE    -> VC   (Vacant and Cleaned)
--   OCCUPIED     -> OCC  (Occupied)
--   RESERVED     -> BLO  (Blocked)              -- never actually written by app code, kept for safety
--   CLEANING     -> VD   (Vacant and Dirty)
--   MAINTENANCE  -> OOO  (Out of Order)
--   OUT_OF_ORDER -> OOO  (Out of Order)
BEGIN;

CREATE TYPE "RoomStatus_new" AS ENUM ('OCC', 'VC', 'VD', 'OR', 'OC', 'OD', 'CO', 'OOO', 'DND', 'V/O', 'O/V', 'LO', 'DO', 'DNCO', 'VCI', 'H/L', 'L/L', 'N/L', 'DL', 'CL', 'HU', 'NCI', 'NS', 'SO', 'BLO', 'V', 'MUR', 'VR', 'SR');

ALTER TABLE "rooms" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "rooms" ALTER COLUMN "status" TYPE "RoomStatus_new" USING (
  CASE "status"::text
    WHEN 'AVAILABLE' THEN 'VC'
    WHEN 'OCCUPIED' THEN 'OCC'
    WHEN 'RESERVED' THEN 'BLO'
    WHEN 'CLEANING' THEN 'VD'
    WHEN 'MAINTENANCE' THEN 'OOO'
    WHEN 'OUT_OF_ORDER' THEN 'OOO'
  END
)::"RoomStatus_new";

ALTER TABLE "room_status_history" ALTER COLUMN "status" TYPE "RoomStatus_new" USING (
  CASE "status"::text
    WHEN 'AVAILABLE' THEN 'VC'
    WHEN 'OCCUPIED' THEN 'OCC'
    WHEN 'RESERVED' THEN 'BLO'
    WHEN 'CLEANING' THEN 'VD'
    WHEN 'MAINTENANCE' THEN 'OOO'
    WHEN 'OUT_OF_ORDER' THEN 'OOO'
  END
)::"RoomStatus_new";

ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";

ALTER TABLE "rooms" ALTER COLUMN "status" SET DEFAULT 'VC';

DROP TYPE "RoomStatus_old";

COMMIT;
