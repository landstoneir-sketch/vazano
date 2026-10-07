import { Injectable } from '@nestjs/common';
import type { SmsPort } from './sms.port';

@Injectable()
export class DebugSmsAdapter implements SmsPort {
  sendOtp(mobile: string): Promise<void> {
    console.info(JSON.stringify({ event: 'otp.debug.sent', mobile: `${mobile.slice(0, 4)}***${mobile.slice(-2)}` }));
    return Promise.resolve();
  }
}
