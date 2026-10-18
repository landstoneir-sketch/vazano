CREATE TYPE "SupplierProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "supplier_profile_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "minimum_order_description" TEXT,
    "lead_time_description" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "status" "SupplierProductStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_products_supplier_profile_id_sku_key" ON "supplier_products"("supplier_profile_id", "sku");
CREATE INDEX "supplier_products_supplier_profile_id_status_updated_at_idx" ON "supplier_products"("supplier_profile_id", "status", "updated_at");
CREATE INDEX "supplier_products_category_id_status_is_available_idx" ON "supplier_products"("category_id", "status", "is_available");

ALTER TABLE "supplier_products"
ADD CONSTRAINT "supplier_products_supplier_profile_id_fkey"
FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_products"
ADD CONSTRAINT "supplier_products_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
