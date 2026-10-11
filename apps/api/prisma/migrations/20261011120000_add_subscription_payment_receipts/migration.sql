-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "amount_rial" BIGINT NOT NULL,
    "tax_rial" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "provider_reference" TEXT,
    "paid_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- Backfill already verified subscription payments so historical receipts remain visible.
INSERT INTO "payment_receipts" (
    "id", "receipt_number", "organization_id", "subscription_id", "payment_intent_id",
    "amount_rial", "tax_rial", "currency", "provider_reference", "paid_at"
)
SELECT
    'receipt_' || md5(payment."id"),
    'VZ-' || to_char(COALESCE(payment."verified_at", payment."updated_at") AT TIME ZONE 'UTC', 'YYYY') || '-' || upper(payment."id"),
    payment."payer_organization_id",
    payment."reference_id",
    payment."id",
    payment."amount_rial",
    0,
    'IRR',
    payment."provider_reference",
    COALESCE(payment."verified_at", payment."updated_at")
FROM "payment_intents" AS payment
INNER JOIN "subscriptions" AS subscription
    ON subscription."id" = payment."reference_id"
   AND subscription."organization_id" = payment."payer_organization_id"
WHERE payment."purpose" = 'SUBSCRIPTION'
  AND payment."status" = 'SUCCEEDED'
  AND payment."payer_organization_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receipt_number_key" ON "payment_receipts"("receipt_number");
CREATE UNIQUE INDEX "payment_receipts_subscription_id_key" ON "payment_receipts"("subscription_id");
CREATE UNIQUE INDEX "payment_receipts_payment_intent_id_key" ON "payment_receipts"("payment_intent_id");
CREATE INDEX "payment_receipts_organization_id_paid_at_idx" ON "payment_receipts"("organization_id", "paid_at");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
