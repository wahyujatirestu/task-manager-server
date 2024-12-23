/*
  Warnings:

  - You are about to drop the `_UserTeams` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_UserTeams" DROP CONSTRAINT "_UserTeams_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserTeams" DROP CONSTRAINT "_UserTeams_B_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "groupId" TEXT NOT NULL DEFAULT 'default-group-id';

-- DropTable
DROP TABLE "_UserTeams";

-- CreateTable
CREATE TABLE "_UserTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserTasks_AB_unique" ON "_UserTasks"("A", "B");

-- CreateIndex
CREATE INDEX "_UserTasks_B_index" ON "_UserTasks"("B");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
