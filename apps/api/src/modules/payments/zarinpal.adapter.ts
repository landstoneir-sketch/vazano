import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentGatewayPort,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from './payment-gateway.port';

type ZarinpalData = {
  code?: number;
  authority?: string;
  ref_id?: number | string;
  card_pan?: string;
};

@Injectable()
export class ZarinpalAdapter implements PaymentGatewayPort {
  readonly provider = 'ZARINPAL' as const;

  constructor(private readonly config: ConfigService) {}

  redirectUrl(authority: string, callbackUrl: string): string {
    void callbackUrl;
    return `${this.settings().startPayUrl}${authority}`;
  }

  async createPayment(input: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const settings = this.settings();
    const response = await this.post(settings.requestUrl, {
      merchant_id: settings.merchantId,
      amount: this.safeAmount(input.amountRial),
      currency: 'IRR',
      callback_url: input.callbackUrl,
      description: input.description,
      metadata: { mobile: input.mobile ?? '', email: input.email ?? '', order_id: input.orderId ?? '' },
    });
    if (response.code !== 100 || !response.authority) throw new BadGatewayException('درگاه پرداخت درخواست را نپذیرفت.');
    return { authority: response.authority, redirectUrl: this.redirectUrl(response.authority, input.callbackUrl) };
  }

  async verifyPayment(input: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const settings = this.settings();
    const response = await this.post(settings.verifyUrl, {
      merchant_id: settings.merchantId,
      amount: this.safeAmount(input.amountRial),
      authority: input.authority,
    });
    const success = response.code === 100 || response.code === 101;
    return {
      success,
      alreadyVerified: response.code === 101,
      referenceId: response.ref_id === undefined ? undefined : String(response.ref_id),
      cardPanMasked: response.card_pan,
      code: response.code ?? -1,
    };
  }

  private settings() {
    const enabled = this.config.get<string>('ZARINPAL_ENABLED') === 'true';
    const merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID');
    if (!enabled || !merchantId) throw new ServiceUnavailableException('درگاه پرداخت هنوز فعال نشده است.');
    const sandbox = this.config.get<string>('ZARINPAL_SANDBOX') !== 'false';
    return {
      merchantId,
      requestUrl: this.config.get<string>('ZARINPAL_REQUEST_URL') ?? (sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json' : 'https://payment.zarinpal.com/pg/v4/payment/request.json'),
      verifyUrl: this.config.get<string>('ZARINPAL_VERIFY_URL') ?? (sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json' : 'https://payment.zarinpal.com/pg/v4/payment/verify.json'),
      startPayUrl: this.config.get<string>('ZARINPAL_START_PAY_URL') ?? (sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://www.zarinpal.com/pg/StartPay/'),
    };
  }

  private safeAmount(amountRial: bigint): number {
    if (amountRial <= 0n || amountRial > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('مبلغ پرداخت معتبر نیست.');
    return Number(amountRial);
  }

  private async post(url: string, body: Record<string, unknown>): Promise<ZarinpalData> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('ارتباط با درگاه پرداخت برقرار نشد.');
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object') throw new BadGatewayException('پاسخ درگاه پرداخت معتبر نیست.');
    const data = 'data' in payload ? (payload as { data?: unknown }).data : undefined;
    if (!data || typeof data !== 'object') throw new BadGatewayException('پاسخ درگاه پرداخت ناقص است.');
    return data;
  }
}
