import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionBillingService } from './subscription-billing.service';
import { SubscriptionPaymentCallbackController } from './subscription-payment-callback.controller';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionLifecycleWorker } from './subscription-lifecycle.worker';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { SubscriptionSmsReminderService } from './subscription-sms-reminder.service';
import { SubscriptionPolicySettingsService } from './subscription-policy-settings.service';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [SubscriptionsController, SubscriptionPaymentCallbackController, AdminBillingController],
  providers: [SubscriptionsService, SubscriptionBillingService, SubscriptionLifecycleService, SubscriptionLifecycleWorker, SubscriptionSmsReminderService, SubscriptionPolicySettingsService, AdminBillingService],
})
export class SubscriptionsModule {}
