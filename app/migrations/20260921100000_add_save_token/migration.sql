-- AlterTable
ALTER TABLE "User" ADD COLUMN "saveToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_saveToken_key" ON "User"("saveToken");
