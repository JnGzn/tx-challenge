-- CreateEnum
CREATE TYPE "ExplanationKind" AS ENUM ('COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "explanations" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT,
    "kind" "ExplanationKind" NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "explanations_transactionId_key" ON "explanations"("transactionId");

-- CreateIndex
CREATE INDEX "explanations_accountId_idx" ON "explanations"("accountId");

-- CreateIndex
CREATE INDEX "processed_events_topic_idx" ON "processed_events"("topic");
