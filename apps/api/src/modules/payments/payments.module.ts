import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MockPaymentAdapter } from './mock-payment.adapter';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentReceiptsController } from './payment-receipts.controller';
import { PaymentReceiptsService } from './payment-receipts.service';
import { ZarinpalAdapter } from './zarinpal.adapter';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentReceiptsController],
  providers: [
    ZarinpalAdapter,
    MockPaymentAdapter,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService, ZarinpalAdapter, MockPaymentAdapter],
      useFactory: (config: ConfigService, zarinpal: ZarinpalAdapter, mock: MockPaymentAdapter) =>
        config.get<string>('PAYMENT_PROVIDER', 'zarinpal') === 'mock' ? mock : zarinpal,
    },
    PaymentsService,
    PaymentReceiptsService,
  ],
  exports: [PAYMENT_GATEWAY, PaymentsService],
})
export class PaymentsModule {}
