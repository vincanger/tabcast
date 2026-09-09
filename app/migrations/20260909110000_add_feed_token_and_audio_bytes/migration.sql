-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "audioBytes" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "feedToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_feedToken_key" ON "User"("feedToken");
