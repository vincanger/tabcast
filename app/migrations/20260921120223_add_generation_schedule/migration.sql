-- CreateTable
CREATE TABLE "GenerationSchedule" (
    "userId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "everyDays" INTEGER NOT NULL DEFAULT 1,
    "hourUtc" INTEGER NOT NULL DEFAULT 7,
    "minuteUtc" INTEGER NOT NULL DEFAULT 0,
    "minArticles" INTEGER NOT NULL DEFAULT 3,
    "minWords" INTEGER NOT NULL DEFAULT 1500,
    "targetMinutes" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationSchedule_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "GenerationSchedule_enabled_nextRunAt_idx" ON "GenerationSchedule"("enabled", "nextRunAt");

-- AddForeignKey
ALTER TABLE "GenerationSchedule" ADD CONSTRAINT "GenerationSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
