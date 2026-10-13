import { RfqsService } from './rfqs.service';

describe('RfqsService commitment payment callbacks', () => {
  it('does not verify a buyer commitment that is already terminal', async () => {
    const prisma = {
      paymentIntent: { findFirst: jest.fn().mockResolvedValue({
        id: 'payment-1', status: 'CANCELLED', referenceId: 'rfq-1', provider: 'ZARINPAL', purpose: 'BUYER_COMMITMENT',
      }) },
    };
    const payments = { verify: jest.fn() };
    const service = new RfqsService(prisma as never, payments as never, {} as never, {} as never);

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toEqual({ success: false, cancelled: true });
    expect(payments.verify).not.toHaveBeenCalled();
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
    const payments = { verify: jest.fn().mockResolvedValue({ success: true, alreadyVerified: false, referenceId: 'ref-1', code: 100 }) };
    const service = new RfqsService(prisma as never, payments as never, {} as never, {} as never);

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toMatchObject({ success: false, cancelled: true });
    expect(tx.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'REDIRECT_PENDING' }, data: { status: 'VERIFY_PENDING' },
    });
    expect(tx.rfq.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
