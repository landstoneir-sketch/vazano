-- AlterTable
ALTER TABLE "quality_control_requests" ADD COLUMN "selected_quotation_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quality_control_requests_selected_quotation_id_key" ON "quality_control_requests"("selected_quotation_id");

-- AddForeignKey
ALTER TABLE "quality_control_requests" ADD CONSTRAINT "quality_control_requests_selected_quotation_id_fkey" FOREIGN KEY ("selected_quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
