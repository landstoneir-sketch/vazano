-- CreateEnum
CREATE TYPE "RfqEntryMethod" AS ENUM ('STANDARD', 'CONVERSATIONAL', 'BOQ', 'IMAGE', 'DRAWING', 'NAMEPLATE', 'FILE');

-- CreateEnum
CREATE TYPE "RfqLifecycleState" AS ENUM ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RfqOperationalStatus" AS ENUM ('DRAFT_INCOMPLETE', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'NEEDS_CHANGES', 'WAITING_COMMITMENT', 'READY_TO_PUBLISH', 'OPEN_FOR_QUOTES', 'HAS_QUOTES', 'NEGOTIATING', 'SELLER_SELECTED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RfqApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RfqSource" AS ENUM ('BUYER_SELF_SERVICE', 'PLATFORM_OPERATOR');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'PAYMENT_PENDING', 'HELD', 'RELEASED_TO_WALLET', 'REFUND_PENDING', 'REFUNDED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('P1M', 'P3M', 'P6M', 'P1Y', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('ZARINPAL', 'MOCK');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'BUYER_COMMITMENT', 'QUALITY_CONTROL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'REDIRECT_PENDING', 'VERIFY_PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditEntryType" AS ENUM ('GRANT', 'RESERVE', 'CONSUME', 'RELEASE', 'REFUND', 'EXPIRE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "QualityControlStatus" AS ENUM ('REQUESTED', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "industry_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "symbol_fa" TEXT NOT NULL,
    "decimal_scale" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyer_organization_id" TEXT NOT NULL,
    "buyer_contact_user_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "operator_user_id" TEXT,
    "primary_domain_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entry_method" "RfqEntryMethod" NOT NULL DEFAULT 'STANDARD',
    "lifecycle_state" "RfqLifecycleState" NOT NULL DEFAULT 'DRAFT',
    "operational_status" "RfqOperationalStatus" NOT NULL DEFAULT 'DRAFT_INCOMPLETE',
    "approval_status" "RfqApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "source" "RfqSource" NOT NULL DEFAULT 'BUYER_SELF_SERVICE',
    "manual_review_required" BOOLEAN NOT NULL DEFAULT true,
    "commitment_status" "CommitmentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "commitment_amount_rial" BIGINT,
    "commitment_policy_version" TEXT,
    "delivery_province" TEXT,
    "delivery_city" TEXT,
    "required_at" TIMESTAMPTZ(3),
    "response_deadline" TIMESTAMPTZ(3),
    "installation_required" BOOLEAN NOT NULL DEFAULT false,
    "quality_control_requested" BOOLEAN NOT NULL DEFAULT false,
    "quality_control_fee_bps" INTEGER,
    "display_prices_tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_items" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "estimated_line_value_rial" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rfq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "description_fa" TEXT,
    "billing_cycle" "BillingCycle" NOT NULL,
    "duration_iso" TEXT NOT NULL,
    "price_rial" BIGINT NOT NULL,
    "grant_credits" BIGINT NOT NULL,
    "daily_proposal_limit" INTEGER NOT NULL DEFAULT 2,
    "max_proposal_limit" INTEGER NOT NULL DEFAULT 6,
    "tax_included" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "grace_ends_at" TIMESTAMPTZ(3),
    "auto_renew_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_renew_consent_at" TIMESTAMPTZ(3),
    "price_rial_snapshot" BIGINT NOT NULL,
    "grant_credit_snapshot" BIGINT NOT NULL,
    "plan_version_snapshot" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_reminders" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "offset_days" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "cached_balance_credits" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "CreditEntryType" NOT NULL,
    "amount_credits" BIGINT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reason_code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount_rial" BIGINT NOT NULL,
    "payer_organization_id" TEXT,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "authority" TEXT,
    "provider_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "callback_payload" JSONB,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_control_requests" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "status" "QualityControlStatus" NOT NULL DEFAULT 'REQUESTED',
    "purchase_amount_rial" BIGINT,
    "fee_bps" INTEGER NOT NULL DEFAULT 300,
    "fee_amount_rial" BIGINT,
    "policy_version" TEXT NOT NULL DEFAULT 'QC_V1',
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "quality_control_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description_fa" TEXT,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "industries_code_key" ON "industries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_industry_id_parent_id_is_active_idx" ON "categories"("industry_id", "parent_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_code_key" ON "rfqs"("code");

-- CreateIndex
CREATE INDEX "rfqs_buyer_organization_id_created_at_idx" ON "rfqs"("buyer_organization_id", "created_at");

-- CreateIndex
CREATE INDEX "rfqs_lifecycle_state_operational_status_idx" ON "rfqs"("lifecycle_state", "operational_status");

-- CreateIndex
CREATE INDEX "rfqs_approval_status_manual_review_required_idx" ON "rfqs"("approval_status", "manual_review_required");

-- CreateIndex
CREATE INDEX "rfq_items_rfq_id_sort_order_idx" ON "rfq_items"("rfq_id", "sort_order");

-- CreateIndex
CREATE INDEX "rfq_items_category_id_idx" ON "rfq_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "subscription_plans_is_active_is_public_idx" ON "subscription_plans"("is_active", "is_public");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_status_idx" ON "subscriptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_expires_at_idx" ON "subscriptions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "subscription_reminders_status_scheduled_at_idx" ON "subscription_reminders"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_reminders_subscription_id_offset_days_channel_key" ON "subscription_reminders"("subscription_id", "offset_days", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_organization_id_key" ON "credit_wallets"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_entries_idempotency_key_key" ON "credit_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_wallet_id_created_at_idx" ON "credit_ledger_entries"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_reference_type_reference_id_idx" ON "credit_ledger_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_authority_key" ON "payment_intents"("authority");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotency_key_key" ON "payment_intents"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_intents_reference_type_reference_id_idx" ON "payment_intents"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "payment_intents_status_created_at_idx" ON "payment_intents"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quality_control_requests_rfq_id_key" ON "quality_control_requests"("rfq_id");

-- CreateIndex
CREATE INDEX "quality_control_requests_status_requested_at_idx" ON "quality_control_requests"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_contact_user_id_fkey" FOREIGN KEY ("buyer_contact_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_primary_domain_id_fkey" FOREIGN KEY ("primary_domain_id") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_reminders" ADD CONSTRAINT "subscription_reminders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_control_requests" ADD CONSTRAINT "quality_control_requests_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
