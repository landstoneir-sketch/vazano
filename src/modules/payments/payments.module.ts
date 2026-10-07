import { Module } from '@nestjs/common';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { ZarinpalAdapter } from './zarinpal.adapter';
import { PaymentsService } from './payments.service';

@Module({
  providers: [ZarinpalAdapter, { provide: PAYMENT_GATEWAY, useExisting: ZarinpalAdapter }, PaymentsService],
  exports: [PAYMENT_GATEWAY, PaymentsService],
})
export class PaymentsModule {}
