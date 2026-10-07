-- CreateEnum
CREATE TYPE "SupplierVerificationStatus" AS ENUM ('INCOMPLETE', 'PENDING', 'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RfqInvitationStatus" AS ENUM ('INVITED', 'VIEWED', 'RESPONDED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISED', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "supplier_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "verification_status" "SupplierVerificationStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "description" TEXT,
    "nationwide_coverage" BOOLEAN NOT NULL DEFAULT false,
    "service_provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verification_reason" TEXT,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_categories" (
    "supplier_profile_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("supplier_profile_id","category_id")
);

-- CreateTable
CREATE TABLE "rfq_invitations" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "supplier_organization_id" TEXT NOT NULL,
    "status" "RfqInvitationStatus" NOT NULL DEFAULT 'INVITED',
    "match_reasons" JSONB NOT NULL DEFAULT '{}',
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed_at" TIMESTAMPTZ(3),
    "responded_at" TIMESTAMPTZ(3),
    "declined_at" TIMESTAMPTZ(3),

    CONSTRAINT "rfq_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "supplier_organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "payment_terms" TEXT,
    "preparation_days" INTEGER,
    "delivery_date" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "subtotal_rial" BIGINT NOT NULL DEFAULT 0,
    "discount_rial" BIGINT NOT NULL DEFAULT 0,
    "tax_rial" BIGINT NOT NULL DEFAULT 0,
    "packaging_rial" BIGINT NOT NULL DEFAULT 0,
    "loading_rial" BIGINT NOT NULL DEFAULT 0,
    "shipping_rial" BIGINT NOT NULL DEFAULT 0,
    "other_costs_rial" BIGINT NOT NULL DEFAULT 0,
    "final_amount_rial" BIGINT NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(3),
    "withdrawn_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "rfq_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "unit_price_rial" BIGINT NOT NULL,
    "discount_rial" BIGINT NOT NULL DEFAULT 0,
    "line_subtotal_rial" BIGINT NOT NULL,
    "line_net_rial" BIGINT NOT NULL,
    "is_alternative" BOOLEAN NOT NULL DEFAULT false,
    "offered_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_organization_id_key" ON "supplier_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_profiles_verification_status_nationwide_coverage_idx" ON "supplier_profiles"("verification_status", "nationwide_coverage");

-- CreateIndex
CREATE INDEX "supplier_categories_category_id_idx" ON "supplier_categories"("category_id");

-- CreateIndex
CREATE INDEX "rfq_invitations_supplier_organization_id_status_invited_at_idx" ON "rfq_invitations"("supplier_organization_id", "status", "invited_at");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_invitations_rfq_id_supplier_organization_id_key" ON "rfq_invitations"("rfq_id", "supplier_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_code_key" ON "quotations"("code");

-- CreateIndex
CREATE INDEX "quotations_rfq_id_status_submitted_at_idx" ON "quotations"("rfq_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "quotations_supplier_organization_id_status_created_at_idx" ON "quotations"("supplier_organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_rfq_id_supplier_organization_id_version_key" ON "quotations"("rfq_id", "supplier_organization_id", "version");

-- CreateIndex
CREATE INDEX "quotation_items_rfq_item_id_idx" ON "quotation_items"("rfq_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_items_quotation_id_rfq_item_id_key" ON "quotation_items"("quotation_id", "rfq_item_id");

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_invitations" ADD CONSTRAINT "rfq_invitations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_invitations" ADD CONSTRAINT "rfq_invitations_supplier_organization_id_fkey" FOREIGN KEY ("supplier_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_supplier_organization_id_fkey" FOREIGN KEY ("supplier_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_rfq_item_id_fkey" FOREIGN KEY ("rfq_item_id") REFERENCES "rfq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
