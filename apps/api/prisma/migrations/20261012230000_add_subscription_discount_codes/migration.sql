CREATE TYPE "SubscriptionDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_RIAL');
CREATE TYPE "DiscountRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'CANCELLED');

ALTER TABLE "subscriptions" ADD COLUMN "list_price_rial_snapshot" BIGINT;
ALTER TABLE "subscriptions" ADD COLUMN "discount_rial_snapshot" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "discount_code_snapshot" TEXT;
UPDATE "subscriptions" SET "list_price_rial_snapshot" = "price_rial_snapshot" WHERE "list_price_rial_snapshot" IS NULL;
ALTER TABLE "subscriptions" ALTER COLUMN "list_price_rial_snapshot" SET NOT NULL;

CREATE TABLE "subscription_discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "description_fa" TEXT,
    "type" "SubscriptionDiscountType" NOT NULL,
    "percentage_bps" INTEGER,
    "fixed_amount_rial" BIGINT,
    "applicable_plan_id" TEXT,
    "minimum_purchase_rial" BIGINT NOT NULL DEFAULT 0,
    "per_organization_limit" INTEGER NOT NULL DEFAULT 1,
    "max_redemptions" INTEGER,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_discount_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_discount_codes_value_check" CHECK (("type" = 'PERCENTAGE' AND "percentage_bps" BETWEEN 1 AND 10000 AND "fixed_amount_rial" IS NULL) OR ("type" = 'FIXED_RIAL' AND "fixed_amount_rial" > 0 AND "percentage_bps" IS NULL)),
    CONSTRAINT "subscription_discount_codes_limits_check" CHECK ("per_organization_limit" > 0 AND ("max_redemptions" IS NULL OR "max_redemptions" > 0) AND "minimum_purchase_rial" >= 0 AND "valid_until" > "valid_from")
);

CREATE TABLE "subscription_discount_redemptions" (
    "id" TEXT NOT NULL,
    "discount_code_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "status" "DiscountRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "discount_amount_rial" BIGINT NOT NULL,
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "subscription_discount_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_discount_redemptions_amount_check" CHECK ("discount_amount_rial" > 0)
);

CREATE UNIQUE INDEX "subscription_discount_codes_code_key" ON "subscription_discount_codes"("code");
CREATE INDEX "subscription_discount_codes_is_active_valid_from_valid_until_idx" ON "subscription_discount_codes"("is_active", "valid_from", "valid_until");
CREATE INDEX "subscription_discount_codes_applicable_plan_id_is_active_idx" ON "subscription_discount_codes"("applicable_plan_id", "is_active");
CREATE UNIQUE INDEX "subscription_discount_redemptions_subscription_id_key" ON "subscription_discount_redemptions"("subscription_id");
CREATE INDEX "subscription_discount_redemptions_discount_code_id_status_idx" ON "subscription_discount_redemptions"("discount_code_id", "status");
CREATE INDEX "subscription_discount_redemptions_discount_code_id_organization_id_status_idx" ON "subscription_discount_redemptions"("discount_code_id", "organization_id", "status");

ALTER TABLE "subscription_discount_codes" ADD CONSTRAINT "subscription_discount_codes_applicable_plan_id_fkey" FOREIGN KEY ("applicable_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_discount_redemptions" ADD CONSTRAINT "subscription_discount_redemptions_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "subscription_discount_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_discount_redemptions" ADD CONSTRAINT "subscription_discount_redemptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_discount_redemptions" ADD CONSTRAINT "subscription_discount_redemptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
