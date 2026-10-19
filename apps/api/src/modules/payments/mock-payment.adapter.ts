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
    return this.demoGatewayUrl({ authority, callbackUrl });
  }

  createPayment(input: CreatePaymentRequest): Promise<CreatePaymentResult> {
    this.assertAllowed();
    const authority = `A${randomUUID().replaceAll('-', '').toUpperCase()}`;
    return Promise.resolve({
      authority,
      redirectUrl: this.demoGatewayUrl({
        authority,
        callbackUrl: input.callbackUrl,
        amountRial: input.amountRial,
        description: input.description,
        orderId: input.orderId,
      }),
    });
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

  private demoGatewayUrl(input: {
    authority: string;
    callbackUrl: string;
    amountRial?: bigint;
    description?: string;
    orderId?: string;
  }): string {
    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000').replace(/\/$/, '');
    const gateway = new URL('/payments/demo', webOrigin);
    gateway.searchParams.set('authority', input.authority);
    gateway.searchParams.set('callback', input.callbackUrl);
    if (input.amountRial !== undefined) gateway.searchParams.set('amountRial', input.amountRial.toString());
    if (input.description) gateway.searchParams.set('description', input.description.slice(0, 160));
    if (input.orderId) gateway.searchParams.set('orderId', input.orderId.slice(0, 80));
    return gateway.toString();
  }
}
