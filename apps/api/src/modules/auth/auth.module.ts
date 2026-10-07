import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { DebugSmsAdapter } from './sms/debug-sms.adapter';
import { SMS_PORT } from './sms/sms.port';
import { SmsIrAdapter } from './sms/smsir.adapter';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService, SessionGuard, DebugSmsAdapter, SmsIrAdapter,
    { provide: SMS_PORT, inject: [ConfigService, DebugSmsAdapter, SmsIrAdapter], useFactory: (config: ConfigService, debug: DebugSmsAdapter, smsIr: SmsIrAdapter) => config.get('SMS_PROVIDER') === 'smsir' ? smsIr : debug },
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
