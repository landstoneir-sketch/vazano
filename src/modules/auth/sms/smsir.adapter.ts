import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsPort } from './sms.port';

@Injectable()
export class SmsIrAdapter implements SmsPort {
  constructor(private readonly config: ConfigService) {}
  async sendOtp(mobile: string, code: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('SMSIR_API_KEY');
    const templateId = Number(this.config.getOrThrow<string>('SMSIR_TEMPLATE_ID'));
    const parameterName = this.config.get<string>('SMSIR_CODE_PARAMETER', 'Code');
    const response = await fetch('https://api.sms.ir/v1/send/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ mobile, templateId, parameters: [{ name: parameterName, value: code }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BadGatewayException('ارسال پیامک در حال حاضر ممکن نیست.');
  }
}
