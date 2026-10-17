ALTER TYPE "AttachmentPurpose" ADD VALUE 'PAYMENT_RECEIPT';

ALTER TABLE "attachments" ADD COLUMN "support_ticket_id" TEXT;

CREATE INDEX "attachments_support_ticket_id_status_created_at_idx"
ON "attachments"("support_ticket_id", "status", "created_at");

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_support_ticket_id_fkey"
FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
