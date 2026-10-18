ALTER TABLE "attachments"
ADD COLUMN "supplier_product_id" TEXT;

CREATE INDEX "attachments_supplier_product_id_status_created_at_idx"
ON "attachments"("supplier_product_id", "status", "created_at");

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_supplier_product_id_fkey"
FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
