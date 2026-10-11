import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentReceiptsController } from './payment-receipts.controller';
import { PaymentReceiptsService } from './payment-receipts.service';
import { ZarinpalAdapter } from './zarinpal.adapter';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentReceiptsController],
  providers: [ZarinpalAdapter, { provide: PAYMENT_GATEWAY, useExisting: ZarinpalAdapter }, PaymentsService, PaymentReceiptsService],
  exports: [PAYMENT_GATEWAY, PaymentsService],
})
export class PaymentsModule {}
