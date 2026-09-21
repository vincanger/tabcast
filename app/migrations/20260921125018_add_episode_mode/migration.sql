-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'summary';

-- AlterTable
ALTER TABLE "GenerationSchedule" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'summary';
