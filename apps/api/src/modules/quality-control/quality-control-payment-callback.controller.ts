import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ZarinpalCallbackQueryDto } from '../payments/zarinpal-callback-query.dto';
import { QualityControlService } from './quality-control.service';

@Controller('quality-control')
export class QualityControlPaymentCallbackController {
  private readonly logger = new Logger(QualityControlPaymentCallbackController.name);

  constructor(private readonly qualityControl: QualityControlService, private readonly config: ConfigService) {}

  @Get('zarinpal/callback')
  async callback(@Query() query: ZarinpalCallbackQueryDto, @Res() response: Response): Promise<void> {
    const webOrigin = (this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
    let payment = 'failed';
    let destination = '/dashboard/rfqs';
    try {
      const result = await this.qualityControl.handlePaymentCallback(query.Authority, query.Status);
      payment = result.success ? 'success' : 'cancelled' in result && result.cancelled ? 'cancelled' : 'processing' in result && result.processing ? 'processing' : 'failed';
      destination = `/dashboard/rfqs/${encodeURIComponent(result.rfqId)}`;
      const search = new URLSearchParams({ qualityPayment: payment });
      if ('receiptId' in result && typeof result.receiptId === 'string') search.set('qualityReceiptId', result.receiptId);
      response.redirect(303, `${webOrigin}${destination}?${search.toString()}`);
      return;
    } catch (error: unknown) {
      this.logger.error(`Quality-control payment callback failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    response.redirect(303, `${webOrigin}${destination}?qualityPayment=${payment}`);
  }
}
