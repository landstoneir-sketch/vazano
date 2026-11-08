-- Public launch policy: buyer RFQ registration is free by default.
-- Preserve successful/held historical payments for financial audit while
-- releasing only unpaid commitments and cancelling their pending intents.
UPDATE "rfqs"
SET
  "commitment_status" = 'NOT_REQUIRED',
  "commitment_amount_rial" = NULL,
  "commitment_policy_version" = NULL,
  "operational_status" = CASE
    WHEN "approval_status" = 'APPROVED' AND "operational_status" = 'WAITING_COMMITMENT'
      THEN 'READY_TO_PUBLISH'
    ELSE "operational_status"
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "commitment_status" IN ('REQUIRED', 'PAYMENT_PENDING');

UPDATE "payment_intents"
SET
  "status" = 'CANCELLED',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "purpose" = 'BUYER_COMMITMENT'
  AND "status" IN ('CREATED', 'REDIRECT_PENDING', 'VERIFY_PENDING');
