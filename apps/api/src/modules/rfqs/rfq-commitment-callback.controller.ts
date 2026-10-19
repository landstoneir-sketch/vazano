import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { RfqsService } from './rfqs.service';
import { ZarinpalCallbackQueryDto } from '../payments/zarinpal-callback-query.dto';

@Controller('rfqs/commitments')
export class RfqCommitmentCallbackController {
  private readonly logger = new Logger(RfqCommitmentCallbackController.name);

  constructor(private readonly rfqs: RfqsService, private readonly config: ConfigService) {}

  @Get('zarinpal/callback')
  async callback(@Query() query: ZarinpalCallbackQueryDto, @Res() response: Response): Promise<void> {
    const webOrigin = (this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
    let payment = 'failed';
    let destination = '/dashboard/rfqs';
    try {
      const result = await this.rfqs.handleCommitmentCallback(query.Authority, query.Status);
      payment = result.success ? 'success' : 'cancelled' in result && result.cancelled ? 'cancelled' : 'processing' in result && result.processing ? 'processing' : 'failed';
      destination = `/dashboard/rfqs/${encodeURIComponent(result.rfqId)}`;
      const search = new URLSearchParams({ commitmentPayment: payment });
      if ('receiptId' in result && typeof result.receiptId === 'string') search.set('receiptId', result.receiptId);
      response.redirect(303, `${webOrigin}${destination}?${search.toString()}`);
      return;
    } catch (error: unknown) {
      this.logger.error(`Buyer-commitment payment callback failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    response.redirect(303, `${webOrigin}${destination}?commitmentPayment=${payment}`);
  }
}
