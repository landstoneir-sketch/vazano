CREATE TABLE "manual_subscription_renewals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "activated_by_user_id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "amount_rial" BIGINT NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_subscription_renewals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manual_subscription_renewals_subscription_id_key" ON "manual_subscription_renewals"("subscription_id");
CREATE UNIQUE INDEX "manual_subscription_renewals_tracking_number_key" ON "manual_subscription_renewals"("tracking_number");
CREATE INDEX "manual_subscription_renewals_organization_id_paid_at_idx" ON "manual_subscription_renewals"("organization_id", "paid_at");
CREATE INDEX "manual_subscription_renewals_activated_by_user_id_created_at_idx" ON "manual_subscription_renewals"("activated_by_user_id", "created_at");

ALTER TABLE "manual_subscription_renewals" ADD CONSTRAINT "manual_subscription_renewals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_subscription_renewals" ADD CONSTRAINT "manual_subscription_renewals_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_subscription_renewals" ADD CONSTRAINT "manual_subscription_renewals_activated_by_user_id_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
