ALTER TABLE "supplier_profiles"
    ADD COLUMN "production_capacity_description" TEXT,
    ADD COLUMN "minimum_order_description" TEXT,
    ADD COLUMN "lead_time_description" TEXT,
    ADD COLUMN "official_invoice_available" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "sample_available" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "installation_available" BOOLEAN NOT NULL DEFAULT false;
