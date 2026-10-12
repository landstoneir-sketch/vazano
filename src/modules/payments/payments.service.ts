import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_GATEWAY, type CreatePaymentRequest, type PaymentGatewayPort, type VerifyPaymentRequest } from './payment-gateway.port';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort) {}

  get provider() {
    return this.gateway.provider;
  }

  redirectUrl(authority: string, callbackUrl: string) {
    return this.gateway.redirectUrl(authority, callbackUrl);
  }

  create(input: CreatePaymentRequest) {
    return this.gateway.createPayment(input);
  }

  verify(input: VerifyPaymentRequest) {
    return this.gateway.verifyPayment(input);
  }
}
