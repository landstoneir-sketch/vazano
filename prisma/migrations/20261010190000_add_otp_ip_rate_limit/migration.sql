-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN "ip_address" TEXT;

-- CreateIndex
CREATE INDEX "otp_codes_ip_address_created_at_idx" ON "otp_codes"("ip_address", "created_at");
