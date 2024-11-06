/*
  Warnings:

  - The values [In-Progress] on the enum `ActivityType` will be removed. If these variants are still used in the database, this will fail.
  - The values [In-Progress] on the enum `TaskStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivityType_new" AS ENUM ('ASSIGNED', 'STARTED', 'IN-PROGRESS', 'BUG', 'COMPLETED', 'COMMENTED');
ALTER TABLE "Activity" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "ActivityType_old";
ALTER TABLE "Activity" ALTER COLUMN "type" SET DEFAULT 'ASSIGNED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStage_new" AS ENUM ('TODO', 'IN-PROGRESS', 'COMPLETED');
ALTER TABLE "Task" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "stage" TYPE "TaskStage_new" USING ("stage"::text::"TaskStage_new");
ALTER TYPE "TaskStage" RENAME TO "TaskStage_old";
ALTER TYPE "TaskStage_new" RENAME TO "TaskStage";
DROP TYPE "TaskStage_old";
ALTER TABLE "Task" ALTER COLUMN "stage" SET DEFAULT 'TODO';
COMMIT;
