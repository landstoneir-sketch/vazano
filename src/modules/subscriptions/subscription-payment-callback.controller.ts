import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ZarinpalCallbackQueryDto } from '../payments/zarinpal-callback-query.dto';
import { SubscriptionBillingService } from './subscription-billing.service';

@Controller('subscriptions')
export class SubscriptionPaymentCallbackController {
  private readonly logger = new Logger(SubscriptionPaymentCallbackController.name);

  constructor(private readonly billing: SubscriptionBillingService, private readonly config: ConfigService) {}

  @Get('zarinpal/callback')
  async callback(@Query() query: ZarinpalCallbackQueryDto, @Res() response: Response): Promise<void> {
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    let payment = 'failed';
    try {
      const result = await this.billing.handleCallback(query.Authority, query.Status);
      payment = result.success ? 'success' : 'cancelled' in result && result.cancelled ? 'cancelled' : 'failed';
    } catch (error: unknown) {
      this.logger.error(`Subscription callback failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    response.redirect(303, `${webOrigin}/supplier/subscription?payment=${payment}`);
  }
}
