CREATE TYPE "BillingInvoicePurpose" AS ENUM ('SUBSCRIPTION', 'QUALITY_CONTROL', 'CONTRACT_SERVICE');
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purpose" "BillingInvoicePurpose" NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "subscription_id" TEXT,
    "payment_intent_id" TEXT,
    "manual_renewal_id" TEXT,
    "net_amount_rial" BIGINT NOT NULL,
    "tax_rial" BIGINT NOT NULL DEFAULT 0,
    "total_amount_rial" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "description_fa" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_invoices_amounts_check" CHECK ("net_amount_rial" >= 0 AND "tax_rial" >= 0 AND "total_amount_rial" = "net_amount_rial" + "tax_rial")
);

CREATE UNIQUE INDEX "billing_invoices_invoice_number_key" ON "billing_invoices"("invoice_number");
CREATE UNIQUE INDEX "billing_invoices_subscription_id_key" ON "billing_invoices"("subscription_id");
CREATE UNIQUE INDEX "billing_invoices_payment_intent_id_key" ON "billing_invoices"("payment_intent_id");
CREATE UNIQUE INDEX "billing_invoices_manual_renewal_id_key" ON "billing_invoices"("manual_renewal_id");
CREATE INDEX "billing_invoices_organization_id_issued_at_idx" ON "billing_invoices"("organization_id", "issued_at");
CREATE INDEX "billing_invoices_status_due_at_idx" ON "billing_invoices"("status", "due_at");

ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_manual_renewal_id_fkey" FOREIGN KEY ("manual_renewal_id") REFERENCES "manual_subscription_renewals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
