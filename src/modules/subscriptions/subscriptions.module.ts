import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionBillingService } from './subscription-billing.service';
import { SubscriptionPaymentCallbackController } from './subscription-payment-callback.controller';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionLifecycleWorker } from './subscription-lifecycle.worker';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [SubscriptionsController, SubscriptionPaymentCallbackController],
  providers: [SubscriptionsService, SubscriptionBillingService, SubscriptionLifecycleService, SubscriptionLifecycleWorker],
})
export class SubscriptionsModule {}
