-- CreateEnum
CREATE TYPE "PaymentReconciliationResolution" AS ENUM (
  'CUSTOMER_RETRY_REQUIRED',
  'PROVIDER_SUPPORT_REQUIRED',
  'REFUND_REVIEW_REQUIRED',
  'NO_FINANCIAL_ACTION'
);

-- AlterTable
ALTER TABLE "payment_intents"
ADD COLUMN "reconciliation_resolution" "PaymentReconciliationResolution",
ADD COLUMN "reconciliation_resolution_note" TEXT,
ADD COLUMN "reconciliation_resolved_at" TIMESTAMP(3) WITH TIME ZONE,
ADD COLUMN "reconciliation_resolved_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "payment_intents"
ADD CONSTRAINT "payment_intents_reconciliation_resolved_by_user_id_fkey"
FOREIGN KEY ("reconciliation_resolved_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "payment_intents_reconciliation_resolved_at_updated_at_idx"
ON "payment_intents"("reconciliation_resolved_at", "updated_at");
