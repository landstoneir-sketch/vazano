-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('NOT_CHECKED', 'MATCHED', 'ACTION_REQUIRED', 'PROVIDER_UNCONFIRMED');

-- AlterTable
ALTER TABLE "payment_intents"
ADD COLUMN "reconciliation_status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN "last_reconciled_at" TIMESTAMP(3) WITH TIME ZONE,
ADD COLUMN "last_provider_code" INTEGER;

-- CreateIndex
CREATE INDEX "payment_intents_reconciliation_status_updated_at_idx" ON "payment_intents"("reconciliation_status", "updated_at");
