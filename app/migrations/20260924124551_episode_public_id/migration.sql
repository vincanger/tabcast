/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Episode` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "publicId" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 10);

-- CreateIndex
CREATE UNIQUE INDEX "Episode_publicId_key" ON "Episode"("publicId");
