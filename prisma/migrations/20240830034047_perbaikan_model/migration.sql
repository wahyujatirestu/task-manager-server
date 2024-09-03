/*
  Warnings:

  - You are about to drop the column `userId` on the `Notice` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `NoticeIsRead` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NoticeTeam` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Notice" DROP CONSTRAINT "Notice_userId_fkey";

-- DropForeignKey
ALTER TABLE "NoticeIsRead" DROP CONSTRAINT "NoticeIsRead_noticeId_fkey";

-- DropForeignKey
ALTER TABLE "NoticeIsRead" DROP CONSTRAINT "NoticeIsRead_userId_fkey";

-- DropForeignKey
ALTER TABLE "NoticeTeam" DROP CONSTRAINT "NoticeTeam_noticeId_fkey";

-- DropForeignKey
ALTER TABLE "NoticeTeam" DROP CONSTRAINT "NoticeTeam_userId_fkey";

-- AlterTable
ALTER TABLE "Notice" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "refreshToken";

-- DropTable
DROP TABLE "NoticeIsRead";

-- DropTable
DROP TABLE "NoticeTeam";

-- CreateTable
CREATE TABLE "_UserNotices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserNotices_AB_unique" ON "_UserNotices"("A", "B");

-- CreateIndex
CREATE INDEX "_UserNotices_B_index" ON "_UserNotices"("B");

-- AddForeignKey
ALTER TABLE "_UserNotices" ADD CONSTRAINT "_UserNotices_A_fkey" FOREIGN KEY ("A") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserNotices" ADD CONSTRAINT "_UserNotices_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
