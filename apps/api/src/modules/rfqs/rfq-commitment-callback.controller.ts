import { Controller, Get, Query } from '@nestjs/common';
import { RfqsService } from './rfqs.service';
import { ZarinpalCallbackQueryDto } from '../payments/zarinpal-callback-query.dto';

@Controller('rfqs/commitments')
export class RfqCommitmentCallbackController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get('zarinpal/callback')
  callback(@Query() query: ZarinpalCallbackQueryDto) {
    return this.rfqs.handleCommitmentCallback(query.Authority, query.Status);
  }
}
