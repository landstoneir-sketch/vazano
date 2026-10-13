import { ConflictException } from '@nestjs/common';
import { RfqsService } from './rfqs.service';

describe('RfqsService commitment payment callbacks', () => {
  it('does not verify a buyer commitment that is already terminal', async () => {
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue({
        id: 'payment-1', status: 'CANCELLED', referenceId: 'rfq-1', provider: 'ZARINPAL', purpose: 'BUYER_COMMITMENT',
      }) },
    };
    const payments = { provider: 'TEST_GATEWAY', verify: jest.fn() };
    const service = new RfqsService(prisma as never, payments as never, {} as never, {} as never);

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toEqual({ success: false, cancelled: true });
    expect(payments.verify).not.toHaveBeenCalled();
    expect(prisma.paymentIntent.findFirst).toHaveBeenCalledWith({
      where: { authority: 'authority-1', provider: 'TEST_GATEWAY', purpose: 'BUYER_COMMITMENT' },
    });
  });

  it('does not activate an RFQ after losing the payment claim', async () => {
    const intent = {
      id: 'payment-1', status: 'REDIRECT_PENDING', referenceId: 'rfq-1', payerOrganizationId: 'buyer-1',
      provider: 'ZARINPAL', purpose: 'BUYER_COMMITMENT', amountRial: 5_000_000n,
    };
    const tx = {
      paymentIntent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...intent, status: 'CANCELLED' }),
      },
      rfq: { update: jest.fn() },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue(intent) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const payments = { provider: 'TEST_GATEWAY', verify: jest.fn().mockResolvedValue({ success: true, alreadyVerified: false, referenceId: 'ref-1', code: 100 }) };
    const service = new RfqsService(prisma as never, payments as never, {} as never, {} as never);

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toMatchObject({ success: false, cancelled: true });
    expect(tx.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'REDIRECT_PENDING' }, data: { status: 'VERIFY_PENDING' },
    });
    expect(tx.rfq.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('requires a fresh idempotency key after a terminal commitment attempt', async () => {
    const prisma = {
      paymentIntent: { findUnique: jest.fn().mockResolvedValue({
        id: 'payment-closed', status: 'FAILED', purpose: 'BUYER_COMMITMENT', referenceId: 'rfq-1', amountRial: 5_000_000n,
      }) },
    };
    const payments = { provider: 'TEST_GATEWAY', create: jest.fn() };
    const service = new RfqsService(prisma as never, payments as never, { get: jest.fn() } as never, {} as never);
    (service as unknown as { findAuthorizedRfq: jest.Mock }).findAuthorizedRfq = jest.fn().mockResolvedValue({
      id: 'rfq-1', approvalStatus: 'APPROVED', commitmentStatus: 'REQUIRED', commitmentAmountRial: 5_000_000n,
      buyerOrganizationId: 'buyer-1', code: 'RFQ-1',
    });

    await expect(service.createCommitmentPayment({ mobile: '09120000000' } as never, 'rfq-1', 'used-key')).rejects.toBeInstanceOf(ConflictException);
    expect(payments.create).not.toHaveBeenCalled();
  });
});
