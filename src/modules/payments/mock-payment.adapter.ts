import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentGatewayPort,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from './payment-gateway.port';

@Injectable()
export class MockPaymentAdapter implements PaymentGatewayPort {
  readonly provider = 'MOCK' as const;

  constructor(private readonly config: ConfigService) {}

  redirectUrl(authority: string, callbackUrl: string): string {
    this.assertAllowed();
    const callback = new URL(callbackUrl);
    callback.searchParams.set('Authority', authority);
    callback.searchParams.set('Status', 'OK');
    return callback.toString();
  }

  createPayment(input: CreatePaymentRequest): Promise<CreatePaymentResult> {
    this.assertAllowed();
    const authority = `A${randomUUID().replaceAll('-', '').toUpperCase()}`;
    return Promise.resolve({ authority, redirectUrl: this.redirectUrl(authority, input.callbackUrl) });
  }

  verifyPayment(input: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    this.assertAllowed();
    const success = input.amountRial > 0n && /^A[0-9A-F]{32}$/.test(input.authority);
    return Promise.resolve({
      success,
      alreadyVerified: false,
      referenceId: success ? `MOCKREF-${input.authority.slice(1, 13)}` : undefined,
      code: success ? 100 : -1,
    });
  }

  private assertAllowed(): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('درگاه آزمایشی پرداخت در محیط عملیاتی مجاز نیست.');
    }
  }
}
