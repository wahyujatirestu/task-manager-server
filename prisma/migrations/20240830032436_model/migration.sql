/*
  Warnings:

  - You are about to drop the `_UserNotices` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `Notice` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_UserNotices" DROP CONSTRAINT "_UserNotices_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserNotices" DROP CONSTRAINT "_UserNotices_B_fkey";

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_UserNotices";

-- CreateTable
CREATE TABLE "NoticeTeam" (
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NoticeTeam_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateTable
CREATE TABLE "NoticeIsRead" (
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NoticeIsRead_pkey" PRIMARY KEY ("noticeId","userId")
);

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeTeam" ADD CONSTRAINT "NoticeTeam_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeTeam" ADD CONSTRAINT "NoticeTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeIsRead" ADD CONSTRAINT "NoticeIsRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeIsRead" ADD CONSTRAINT "NoticeIsRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
