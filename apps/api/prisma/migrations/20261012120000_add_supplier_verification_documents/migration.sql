ALTER TABLE "attachments"
ADD COLUMN "supplier_profile_id" TEXT;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_supplier_profile_id_fkey"
FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "attachments_supplier_profile_id_status_created_at_idx"
ON "attachments"("supplier_profile_id", "status", "created_at");
