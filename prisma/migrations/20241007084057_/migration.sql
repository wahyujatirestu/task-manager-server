/*
  Warnings:

  - The `type` column on the `Activity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `stage` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TaskStage" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ASSIGNED', 'STARTED', 'IN_PROGRESS', 'BUG', 'COMPLETED', 'COMMENTED');

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "type",
ADD COLUMN     "type" "ActivityType" NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "stage",
ADD COLUMN     "stage" "TaskStage" NOT NULL DEFAULT 'TODO';
