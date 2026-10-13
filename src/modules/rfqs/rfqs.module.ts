import { Module } from '@nestjs/common';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { RfqCommitmentCallbackController } from './rfq-commitment-callback.controller';
import { RfqPolicySettingsService } from './rfq-policy-settings.service';

@Module({ imports: [AuthModule, PaymentsModule], controllers: [RfqsController, RfqCommitmentCallbackController], providers: [RfqsService, RfqPolicySettingsService] })
export class RfqsModule {}
