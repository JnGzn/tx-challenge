-- Rename table and restructure: drop text/model, rename raw -> payload, keep eventId/eventType.
ALTER TABLE "explanations" RENAME TO "events";

ALTER TABLE "events" RENAME CONSTRAINT "explanations_pkey" TO "events_pkey";

ALTER INDEX "explanations_eventId_key"         RENAME TO "events_eventId_key";
ALTER INDEX "explanations_accountId_idx"       RENAME TO "events_accountId_idx";
ALTER INDEX "explanations_transactionId_idx"   RENAME TO "events_transactionId_idx";
ALTER INDEX "explanations_eventType_idx"       RENAME TO "events_eventType_idx";

ALTER TABLE "events" RENAME COLUMN "raw" TO "payload";

ALTER TABLE "events"
  DROP COLUMN "text",
  DROP COLUMN "model";
