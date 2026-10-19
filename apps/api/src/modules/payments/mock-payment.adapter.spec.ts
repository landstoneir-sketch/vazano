import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockPaymentAdapter } from './mock-payment.adapter';

describe('MockPaymentAdapter', () => {
  it('returns the visible local gateway and verifies its generated authority', async () => {
    const adapter = new MockPaymentAdapter(new ConfigService({ NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:3100' }));
    const payment = await adapter.createPayment({
      amountRial: 1_000_000n,
      description: 'آزمون پرداخت',
      callbackUrl: 'http://localhost:3101/v1/payments/callback',
    });

    expect(payment.redirectUrl).toContain('http://localhost:3100/payments/demo');
    expect(payment.redirectUrl).toContain(encodeURIComponent('http://localhost:3101/v1/payments/callback'));
    expect(payment.redirectUrl).toContain('amountRial=1000000');
    await expect(adapter.verifyPayment({ amountRial: 1_000_000n, authority: payment.authority }))
      .resolves.toMatchObject({ success: true, code: 100 });
  });

  it('is disabled in production', () => {
    const adapter = new MockPaymentAdapter(new ConfigService({ NODE_ENV: 'production' }));
    expect(() => adapter.createPayment({ amountRial: 1n, description: 'test', callbackUrl: 'https://api.vazano.ir/callback' }))
      .toThrow(ServiceUnavailableException);
  });
});
