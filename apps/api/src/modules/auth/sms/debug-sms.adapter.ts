import { Injectable } from '@nestjs/common';
import type { SmsPort, SmsTemplateCode, SmsTemplateParameter } from './sms.port';

@Injectable()
export class DebugSmsAdapter implements SmsPort {
  sendOtp(mobile: string): Promise<void> {
    console.info(JSON.stringify({ event: 'otp.debug.sent', mobile: `${mobile.slice(0, 4)}***${mobile.slice(-2)}` }));
    return Promise.resolve();
  }

  sendTemplate(mobile: string, templateCode: SmsTemplateCode, parameters: SmsTemplateParameter[]): Promise<void> {
    console.info(JSON.stringify({
      event: 'sms.debug.sent',
      mobile: `${mobile.slice(0, 4)}***${mobile.slice(-2)}`,
      templateCode,
      parameterNames: parameters.map((parameter) => parameter.name),
    }));
    return Promise.resolve();
  }
}
