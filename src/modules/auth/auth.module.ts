import { Logger, Module } from '@nestjs/common';
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
    {
      provide: SMS_PORT,
      inject: [ConfigService, DebugSmsAdapter, SmsIrAdapter],
      useFactory: (config: ConfigService, debug: DebugSmsAdapter, smsIr: SmsIrAdapter) => {
        if (config.get<string>('SMS_PROVIDER') !== 'smsir') return debug;
        if (config.get<string>('SMSIR_API_KEY')?.trim()) return smsIr;
        if (config.get<string>('NODE_ENV', 'development') !== 'production') {
          new Logger('SmsProvider').warn('SMS.ir is selected but its local API key is missing; debug SMS remains active.');
        }
        return debug;
      },
    },
  ],
  exports: [AuthService, SessionGuard, SMS_PORT],
})
export class AuthModule {}
