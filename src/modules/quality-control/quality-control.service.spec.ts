import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PaymentsService } from '../payments/payments.service';
import { QualityControlService } from './quality-control.service';

const buyer: AuthenticatedUser = {
  id: 'buyer-user',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'buyer-org', role: 'BUYER_OWNER' }],
};

const quotedRequest = {
  id: 'quality-request',
  rfqId: 'rfq-1',
  status: 'QUOTED',
  purchaseAmountRial: 1_000_000_000n,
  feeAmountRial: 30_000_000n,
  feeBps: 300,
  selectedQuotationId: 'quotation-1',
  rfq: { buyerOrganizationId: 'buyer-org' },
  selectedQuotation: { id: 'quotation-1', code: 'Q-1' },
};

describe('QualityControlService payments', () => {
  it('rejects checkout by a user outside the buyer organization', async () => {
    const createPayment = jest.fn();
    const prisma = { qualityControlRequest: { findUnique: jest.fn().mockResolvedValue(quotedRequest) } } as unknown as PrismaService;
    const payments = { provider: 'ZARINPAL', create: createPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService());

    await expect(service.startCheckout({ ...buyer, memberships: [] }, 'rfq-1', 'quality-key-123')).rejects.toBeInstanceOf(ForbiddenException);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('creates an idempotent payment intent for exactly the quoted three-percent fee', async () => {
    const createPayment = jest.fn().mockResolvedValue({ authority: 'authority-1', redirectUrl: 'https://payment.example/authority-1' });
    const createIntent = jest.fn().mockResolvedValue({ id: 'payment-1', amountRial: 30_000_000n });
    const updateIntent = jest.fn().mockResolvedValue({});
    const claimIntent = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue(quotedRequest) },
      paymentIntent: { findUnique: jest.fn().mockResolvedValue(null), create: createIntent, updateMany: claimIntent, update: updateIntent },
    } as unknown as PrismaService;
    const payments = { provider: 'ZARINPAL', create: createPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService({ PUBLIC_API_URL: 'https://api.vazano.ir' }));

    const result = await service.startCheckout(buyer, 'rfq-1', 'quality-key-123');

    expect(createIntent).toHaveBeenCalledWith({ data: {
      provider: 'ZARINPAL', purpose: 'QUALITY_CONTROL', amountRial: 30_000_000n, payerOrganizationId: 'buyer-org',
      referenceType: 'QualityControlRequest', referenceId: 'quality-request', idempotencyKey: 'quality-key-123',
    } });
    expect(createPayment).toHaveBeenCalledWith({
      amountRial: 30_000_000n,
      description: 'خدمت کنترل کیفیت استعلام rfq-1',
      callbackUrl: 'https://api.vazano.ir/v1/quality-control/zarinpal/callback',
      mobile: '09120000000',
      orderId: 'quality-request',
    });
    expect(claimIntent).toHaveBeenCalledWith({ where: { id: 'payment-1', status: 'CREATED', authority: null }, data: { status: 'REDIRECT_PENDING' } });
    expect(updateIntent).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { authority: 'authority-1' } });
    expect(result.redirectUrl).toBe('https://payment.example/authority-1');
  });

  it('does not create a duplicate provider request while checkout is being prepared', async () => {
    const createPayment = jest.fn();
    const prisma = {
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue(quotedRequest) },
      paymentIntent: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-pending', status: 'REDIRECT_PENDING', authority: null, purpose: 'QUALITY_CONTROL',
        referenceId: 'quality-request', payerOrganizationId: 'buyer-org', amountRial: 30_000_000n,
      }) },
    } as unknown as PrismaService;
    const payments = { provider: 'ZARINPAL', create: createPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService());

    await expect(service.startCheckout(buyer, 'rfq-1', 'quality-key-123')).resolves.toEqual({
      paymentIntentId: 'payment-pending', processing: true,
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('does not verify or activate an already completed callback again', async () => {
    const verifyPayment = jest.fn();
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue({ id: 'payment-1', status: 'SUCCEEDED', payerOrganizationId: 'buyer-org', referenceId: 'quality-request', providerReference: 'reference-1' }) },
      paymentReceipt: { findUnique: jest.fn().mockResolvedValue({ id: 'receipt-1', receiptNumber: 'VZ-2026-PAYMENT-1' }) },
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'quality-request', rfqId: 'rfq-1' }) },
    } as unknown as PrismaService;
    const payments = { provider: 'ZARINPAL', verify: verifyPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService());

    await expect(service.handlePaymentCallback('authority-1', 'OK')).resolves.toEqual({
      success: true, alreadyVerified: true, referenceId: 'reference-1', rfqId: 'rfq-1', receiptId: 'receipt-1', receiptNumber: 'VZ-2026-PAYMENT-1',
    });
    expect(verifyPayment).not.toHaveBeenCalled();
  });

  it('does not verify or activate a terminal cancelled callback', async () => {
    const verifyPayment = jest.fn();
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue({ id: 'payment-1', status: 'CANCELLED', payerOrganizationId: 'buyer-org', referenceId: 'quality-request' }) },
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'quality-request', rfqId: 'rfq-1' }) },
    } as unknown as PrismaService;
    const payments = { provider: 'ZARINPAL', verify: verifyPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService());

    await expect(service.handlePaymentCallback('authority-1', 'OK')).resolves.toEqual({ success: false, cancelled: true, rfqId: 'rfq-1' });
    expect(verifyPayment).not.toHaveBeenCalled();
  });

  it('requires a fresh idempotency key after a terminal checkout attempt', async () => {
    const prisma = {
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue(quotedRequest) },
      paymentIntent: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-closed', status: 'FAILED', purpose: 'QUALITY_CONTROL', referenceId: 'quality-request',
        payerOrganizationId: 'buyer-org', amountRial: 30_000_000n,
      }) },
    } as unknown as PrismaService;
    const createPayment = jest.fn();
    const payments = { provider: 'ZARINPAL', create: createPayment } as unknown as PaymentsService;
    const service = new QualityControlService(prisma, payments, new ConfigService());

    await expect(service.startCheckout(buyer, 'rfq-1', 'used-key')).rejects.toBeInstanceOf(ConflictException);
    expect(createPayment).not.toHaveBeenCalled();
  });
});
