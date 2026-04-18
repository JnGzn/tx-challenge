-- DropIndex
DROP INDEX "explanations_transactionId_key";

-- AlterTable: add eventId/eventType, make transactionId optional, drop kind
ALTER TABLE "explanations"
  ADD COLUMN "eventId"   TEXT,
  ADD COLUMN "eventType" TEXT,
  ALTER COLUMN "transactionId" DROP NOT NULL;

-- Best-effort backfill for any existing rows so the NOT NULL constraints below hold.
UPDATE "explanations"
SET "eventId"   = COALESCE("eventId",   "id"),
    "eventType" = COALESCE("eventType", CASE "kind"::TEXT
                                          WHEN 'COMPLETED' THEN 'transaction.completed'
                                          WHEN 'REJECTED'  THEN 'transaction.rejected'
                                          ELSE 'unknown'
                                        END);

ALTER TABLE "explanations"
  ALTER COLUMN "eventId"   SET NOT NULL,
  ALTER COLUMN "eventType" SET NOT NULL,
  DROP COLUMN "kind";

-- DropEnum
DROP TYPE "ExplanationKind";

-- CreateIndex
CREATE UNIQUE INDEX "explanations_eventId_key" ON "explanations"("eventId");
CREATE INDEX "explanations_transactionId_idx" ON "explanations"("transactionId");
CREATE INDEX "explanations_eventType_idx" ON "explanations"("eventType");
