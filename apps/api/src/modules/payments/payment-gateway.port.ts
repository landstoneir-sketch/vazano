import type { PaymentProvider } from '@prisma/client';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type CreatePaymentRequest = {
  amountRial: bigint;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
  orderId?: string;
};

export type CreatePaymentResult = {
  authority: string;
  redirectUrl: string;
};

export type VerifyPaymentRequest = {
  amountRial: bigint;
  authority: string;
};

export type VerifyPaymentResult = {
  success: boolean;
  alreadyVerified: boolean;
  referenceId?: string;
  cardPanMasked?: string;
  code: number;
};

export interface PaymentGatewayPort {
  readonly provider: PaymentProvider;
  redirectUrl(authority: string, callbackUrl: string): string;
  createPayment(input: CreatePaymentRequest): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentRequest): Promise<VerifyPaymentResult>;
}
