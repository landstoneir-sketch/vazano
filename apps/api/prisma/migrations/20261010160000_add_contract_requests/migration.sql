-- CreateEnum
CREATE TYPE "ContractRequestStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'TERMS_PREPARED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "selected_quotation_id" TEXT NOT NULL,
    "buyer_organization_id" TEXT NOT NULL,
    "supplier_organization_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "ContractRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "buyer_note" TEXT,
    "terms_summary" TEXT,
    "cancellation_reason" TEXT,
    "requested_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3) WITH TIME ZONE,
    "terms_prepared_at" TIMESTAMP(3) WITH TIME ZONE,
    "accepted_at" TIMESTAMP(3) WITH TIME ZONE,
    "completed_at" TIMESTAMP(3) WITH TIME ZONE,
    "cancelled_at" TIMESTAMP(3) WITH TIME ZONE,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,

    CONSTRAINT "contract_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_requests_code_key" ON "contract_requests"("code");
CREATE UNIQUE INDEX "contract_requests_rfq_id_key" ON "contract_requests"("rfq_id");
CREATE UNIQUE INDEX "contract_requests_selected_quotation_id_key" ON "contract_requests"("selected_quotation_id");
CREATE INDEX "contract_requests_status_requested_at_idx" ON "contract_requests"("status", "requested_at");
CREATE INDEX "contract_requests_buyer_organization_id_requested_at_idx" ON "contract_requests"("buyer_organization_id", "requested_at");
CREATE INDEX "contract_requests_supplier_organization_id_requested_at_idx" ON "contract_requests"("supplier_organization_id", "requested_at");

-- AddForeignKey
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_selected_quotation_id_fkey" FOREIGN KEY ("selected_quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_supplier_organization_id_fkey" FOREIGN KEY ("supplier_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
