-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING_UPLOAD', 'PENDING_SCAN', 'READY', 'QUARANTINED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "AttachmentPurpose" AS ENUM ('GENERAL', 'PRODUCT_IMAGE', 'DRAWING', 'BILL_OF_QUANTITIES', 'SPECIFICATION', 'PROFORMA', 'CERTIFICATE');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "rfq_id" TEXT,
    "quotation_id" TEXT,
    "purpose" "AttachmentPurpose" NOT NULL DEFAULT 'GENERAL',
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT,
    "scan_provider" TEXT,
    "scan_reason" TEXT,
    "uploaded_at" TIMESTAMPTZ(3),
    "scanned_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_rfq_id_status_created_at_idx" ON "attachments"("rfq_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "attachments_quotation_id_status_created_at_idx" ON "attachments"("quotation_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "attachments_organization_id_created_at_idx" ON "attachments"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_status_created_at_idx" ON "attachments"("status", "created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
