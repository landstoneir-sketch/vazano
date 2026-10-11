import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { QualityControlController } from './quality-control.controller';
import { QualityControlPaymentCallbackController } from './quality-control-payment-callback.controller';
import { QualityControlService } from './quality-control.service';

@Module({ imports: [AuthModule, PaymentsModule], controllers: [QualityControlController, QualityControlPaymentCallbackController], providers: [QualityControlService] })
export class QualityControlModule {}
