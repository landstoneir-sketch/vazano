CREATE TYPE "SupplierReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

CREATE TABLE "supplier_reviews" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "buyer_organization_id" TEXT NOT NULL,
    "supplier_organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "SupplierReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderation_reason" TEXT,
    "moderated_by_user_id" TEXT,
    "moderated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supplier_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "supplier_reviews_rfq_id_key" ON "supplier_reviews"("rfq_id");
CREATE UNIQUE INDEX "supplier_reviews_quotation_id_key" ON "supplier_reviews"("quotation_id");
CREATE INDEX "supplier_reviews_supplier_organization_id_status_created_at_idx" ON "supplier_reviews"("supplier_organization_id", "status", "created_at");
CREATE INDEX "supplier_reviews_buyer_organization_id_created_at_idx" ON "supplier_reviews"("buyer_organization_id", "created_at");

ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_supplier_organization_id_fkey" FOREIGN KEY ("supplier_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
