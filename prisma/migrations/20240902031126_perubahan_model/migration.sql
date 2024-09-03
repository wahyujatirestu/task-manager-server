/*
  Warnings:

  - You are about to drop the `_UserNotices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_UserNotices" DROP CONSTRAINT "_UserNotices_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserNotices" DROP CONSTRAINT "_UserNotices_B_fkey";

-- DropTable
DROP TABLE "_UserNotices";

-- CreateTable
CREATE TABLE "NoticeIsRead" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NoticeIsRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoticeIsRead_noticeId_userId_key" ON "NoticeIsRead"("noticeId", "userId");

-- AddForeignKey
ALTER TABLE "NoticeIsRead" ADD CONSTRAINT "NoticeIsRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeIsRead" ADD CONSTRAINT "NoticeIsRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
