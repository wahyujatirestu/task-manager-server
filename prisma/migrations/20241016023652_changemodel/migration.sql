/*
  Warnings:

  - The values [ASSIGNED,STARTED,BUG,COMPLETED,COMMENTED] on the enum `ActivityType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivityType_new" AS ENUM ('Assigned', 'Started', 'IN-PROGRESS', 'Bug', 'Completed', 'Commented');
ALTER TABLE "Activity" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "ActivityType_old";
ALTER TABLE "Activity" ALTER COLUMN "type" SET DEFAULT 'Assigned';
COMMIT;

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "type" SET DEFAULT 'Assigned';
