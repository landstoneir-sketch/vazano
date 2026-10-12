ALTER TABLE "organizations"
ADD COLUMN "subscription_trial_redeemed_at" TIMESTAMPTZ(3);

ALTER TABLE "subscription_plans"
ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscriptions"
ADD COLUMN "is_trial_snapshot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trial_activation_key" TEXT;

CREATE UNIQUE INDEX "subscriptions_trial_activation_key_key"
ON "subscriptions"("trial_activation_key");

