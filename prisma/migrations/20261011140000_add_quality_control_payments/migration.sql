-- AlterTable
ALTER TABLE "payment_receipts" ALTER COLUMN "subscription_id" DROP NOT NULL;
ALTER TABLE "payment_receipts" ADD COLUMN "quality_control_request_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_quality_control_request_id_key" ON "payment_receipts"("quality_control_request_id");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_quality_control_request_id_fkey" FOREIGN KEY ("quality_control_request_id") REFERENCES "quality_control_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A receipt must belong to exactly one billable subject.
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_single_subject_check"
CHECK (num_nonnulls("subscription_id", "quality_control_request_id") = 1);
