import { Controller, Get, Query } from '@nestjs/common';
import { ZarinpalCallbackQueryDto } from '../payments/zarinpal-callback-query.dto';
import { SubscriptionBillingService } from './subscription-billing.service';

@Controller('subscriptions')
export class SubscriptionPaymentCallbackController {
  constructor(private readonly billing: SubscriptionBillingService) {}

  @Get('zarinpal/callback')
  callback(@Query() query: ZarinpalCallbackQueryDto) {
    return this.billing.handleCallback(query.Authority, query.Status);
  }
}
