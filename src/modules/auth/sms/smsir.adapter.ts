import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsPort, SmsTemplateCode, SmsTemplateParameter } from './sms.port';

const TEMPLATE_ID_CONFIG_KEYS: Readonly<Record<SmsTemplateCode, string>> = {
  OTP_LOGIN: 'SMSIR_TEMPLATE_ID',
  SUBSCRIPTION_RENEWAL_14_DAYS: 'SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID',
  SUBSCRIPTION_RENEWAL_7_DAYS: 'SMSIR_SUBSCRIPTION_RENEWAL_7_TEMPLATE_ID',
  SUBSCRIPTION_RENEWAL_3_DAYS: 'SMSIR_SUBSCRIPTION_RENEWAL_3_TEMPLATE_ID',
  SUBSCRIPTION_EXPIRED: 'SMSIR_SUBSCRIPTION_EXPIRED_TEMPLATE_ID',
  SUBSCRIPTION_GRACE_ENDED: 'SMSIR_SUBSCRIPTION_GRACE_ENDED_TEMPLATE_ID',
};

@Injectable()
export class SmsIrAdapter implements SmsPort {
  constructor(private readonly config: ConfigService) {}
  async sendOtp(mobile: string, code: string): Promise<void> {
    const parameterName = this.config.get<string>('SMSIR_CODE_PARAMETER', 'Code');
    await this.sendTemplate(mobile, 'OTP_LOGIN', [{ name: parameterName, value: code }]);
  }

  async sendTemplate(mobile: string, templateCode: SmsTemplateCode, parameters: SmsTemplateParameter[]): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('SMSIR_API_KEY');
    const templateId = Number(this.config.getOrThrow<string>(TEMPLATE_ID_CONFIG_KEYS[templateCode]));
    const response = await fetch('https://api.sms.ir/v1/send/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ mobile, templateId, parameters }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BadGatewayException('ارسال پیامک در حال حاضر ممکن نیست.');
  }
}
