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

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toEqual({ success: false, cancelled: true, rfqId: 'rfq-1' });
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
      paymentReceipt: { findUnique: jest.fn(), create: jest.fn() },
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
    expect(tx.paymentReceipt.create).not.toHaveBeenCalled();
  });

  it('issues exactly one receipt while confirming a buyer commitment', async () => {
    const intent = {
      id: 'payment-1', status: 'REDIRECT_PENDING', referenceId: 'rfq-1', payerOrganizationId: 'buyer-1',
      provider: 'TEST_GATEWAY', purpose: 'BUYER_COMMITMENT', amountRial: 5_000_000n,
    };
    let receiptCreateInput: { data: Record<string, unknown> } | undefined;
    let paymentUpdateInput: { where: { id: string }; data: Record<string, unknown> } | undefined;
    const tx = {
      paymentIntent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn((input: { where: { id: string }; data: Record<string, unknown> }) => {
          paymentUpdateInput = input;
          return Promise.resolve();
        }),
      },
      paymentReceipt: {
        create: jest.fn((input: { data: Record<string, unknown> }) => {
          receiptCreateInput = input;
          return Promise.resolve({ id: 'receipt-1', receiptNumber: 'VZ-2026-PAYMENT-1' });
        }),
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

    await expect(service.handleCommitmentCallback('authority-1', 'OK')).resolves.toMatchObject({
      success: true, rfqId: 'rfq-1', receiptId: 'receipt-1', receiptNumber: 'VZ-2026-PAYMENT-1',
    });
    expect(receiptCreateInput?.data).toMatchObject({
      organizationId: 'buyer-1', paymentIntentId: 'payment-1', amountRial: 5_000_000n, taxRial: 0n, currency: 'IRR', providerReference: 'ref-1',
    });
    expect(paymentUpdateInput).toMatchObject({ where: { id: 'payment-1' }, data: { status: 'SUCCEEDED', providerReference: 'ref-1' } });
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

describe('RfqsService response deadlines', () => {
  it('moves RFQs with quotes to negotiation and expires RFQs without quotes', async () => {
    const candidates = [
      { id: 'rfq-with-quotes', buyerOrganizationId: 'buyer-1', operationalStatus: 'HAS_QUOTES' },
      { id: 'rfq-without-quotes', buyerOrganizationId: 'buyer-2', operationalStatus: 'OPEN_FOR_QUOTES' },
    ];
    const tx = {
      rfq: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      rfq: { findMany: jest.fn().mockResolvedValue(candidates) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);
    const now = new Date('2026-10-14T10:00:00.000Z');

    await expect(service.processResponseDeadlines(now)).resolves.toEqual({ negotiating: 1, expired: 1 });
    expect(tx.rfq.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { operationalStatus: 'NEGOTIATING' } }));
    expect(tx.rfq.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { lifecycleState: 'EXPIRED', operationalStatus: 'EXPIRED', closedAt: now } }));
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
  });
});

describe('RfqsService supplier invitation decisions', () => {
  const supplierUser = {
    id: 'supplier-user-1',
    memberships: [{ organizationId: 'supplier-1', role: 'SUPPLIER_MANAGER' }],
  };

  it('declines an open invitation atomically and records operational evidence', async () => {
    const invitation = {
      id: 'invitation-1', rfqId: 'rfq-1', supplierOrganizationId: 'supplier-1', status: 'INVITED',
      rfq: { id: 'rfq-1', lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES', responseDeadline: null },
    };
    const declined = { ...invitation, status: 'DECLINED' };
    let invitationUpdateInput: { data: { status: string; declinedAt: Date } } | undefined;
    const tx = {
      rfqInvitation: {
        updateMany: jest.fn((input: { data: { status: string; declinedAt: Date } }) => {
          invitationUpdateInput = input;
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(declined),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      rfqInvitation: { findUnique: jest.fn().mockResolvedValue(invitation) },
      quotation: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.declineInvitation(supplierUser as never, invitation.id)).resolves.toEqual(declined);
    expect(invitationUpdateInput?.data.status).toBe('DECLINED');
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('does not decline an invitation when an active quotation exists', async () => {
    const prisma = {
      rfqInvitation: { findUnique: jest.fn().mockResolvedValue({
        id: 'invitation-1', rfqId: 'rfq-1', supplierOrganizationId: 'supplier-1', status: 'VIEWED',
        rfq: { lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES', responseDeadline: null },
      }) },
      quotation: { findFirst: jest.fn().mockResolvedValue({ id: 'quotation-1' }) },
    };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.declineInvitation(supplierUser as never, 'invitation-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks the supplier invitation as viewed only once', async () => {
    let updateInput: { data: { status: string; viewedAt: Date } } | undefined;
    const invitation = { id: 'invitation-1', rfqId: 'rfq-1', supplierOrganizationId: 'supplier-1', status: 'INVITED', viewedAt: null };
    const prisma = {
      rfqInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation),
        updateMany: jest.fn((input: { data: { status: string; viewedAt: Date } }) => {
          updateInput = input;
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.markInvitationViewed(supplierUser as never, 'rfq-1', 'supplier-1')).resolves.toMatchObject({ status: 'VIEWED' });
    expect(updateInput?.data.status).toBe('VIEWED');
    expect(updateInput?.data.viewedAt).toBeInstanceOf(Date);
  });
});

describe('RfqsService buyer cancellation', () => {
  const buyerUser = {
    id: 'buyer-user-1', permissions: [], memberships: [{ organizationId: 'buyer-1', role: 'BUYER_OWNER' }],
  };

  it('cancels the RFQ and fully refunds submitted proposal credits', async () => {
    const rfq = {
      id: 'rfq-1', buyerOrganizationId: 'buyer-1', lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES',
      commitmentStatus: 'NOT_REQUIRED', items: [],
    };
    let refundLedgerInput: { data: { amountCredits: bigint; reasonCode: string } } | undefined;
    const tx = {
      quotation: {
        findMany: jest.fn().mockResolvedValue([{ id: 'quotation-1', status: 'SUBMITTED', supplierOrganizationId: 'supplier-1' }]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      creditLedgerEntry: {
        findMany: jest.fn().mockResolvedValue([{ walletId: 'wallet-1', amountCredits: -300_000n, referenceId: 'quotation-1', idempotencyKey: 'quotation:quotation-1:submit:v1' }]),
        create: jest.fn((input: { data: { amountCredits: bigint; reasonCode: string } }) => {
          refundLedgerInput = input;
          return Promise.resolve({});
        }),
      },
      rfqInvitation: {
        findMany: jest.fn().mockResolvedValue([{ supplierOrganizationId: 'supplier-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      rfq: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...rfq, lifecycleState: 'CANCELLED', operationalStatus: 'CANCELLED' }),
      },
      qualityControlRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      creditWallet: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      rfq: { findUnique: jest.fn().mockResolvedValue(rfq) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.cancel(buyerUser as never, rfq.id, 'تغییر نیاز پروژه')).resolves.toMatchObject({ refundedCredits: '300000' });
    expect(tx.creditWallet.update).toHaveBeenCalledTimes(1);
    expect(refundLedgerInput?.data.amountCredits).toBe(300_000n);
    expect(refundLedgerInput?.data.reasonCode).toBe('RFQ_CANCELLED_FULL_REFUND');
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('requires support handling when buyer commitment money is active', async () => {
    const prisma = { rfq: { findUnique: jest.fn().mockResolvedValue({
      id: 'rfq-1', buyerOrganizationId: 'buyer-1', lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES',
      commitmentStatus: 'HELD', items: [],
    }) } };
    const service = new RfqsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.cancel(buyerUser as never, 'rfq-1', 'تغییر نیاز پروژه')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RfqsService draft editing', () => {
  const buyerUser = {
    id: 'buyer-user-1', permissions: [], memberships: [{ organizationId: 'buyer-1', role: 'BUYER_OWNER' }],
  };
  const originalUpdatedAt = new Date('2026-10-14T08:00:00.000Z');
  const draft = {
    id: 'rfq-1', buyerOrganizationId: 'buyer-1', buyerContactUserId: 'buyer-user-1',
    lifecycleState: 'DRAFT', operationalStatus: 'DRAFT_INCOMPLETE', updatedAt: originalUpdatedAt,
    description: null, entryMethod: 'STANDARD', requiredAt: null, responseDeadline: null, items: [],
  };
  const input = {
    expectedUpdatedAt: originalUpdatedAt.toISOString(), buyerOrganizationId: 'buyer-1', primaryDomainId: 'stone',
    title: 'سنگ نمای پروژه', deliveryProvinceId: 'province-1', deliveryCityId: 'city-1',
    installationRequired: false, qualityControlRequested: true,
    items: [{ categoryId: 'category-1', unitId: 'unit-1', title: 'تراورتن کرم', quantity: '120', specifications: {} }],
  };

  it('replaces draft items atomically and records the edit', async () => {
    const updated = { ...draft, title: input.title, updatedAt: new Date('2026-10-14T08:05:00.000Z') };
    const tx = {
      rfq: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(updated) },
      rfqItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      qualityControlRequest: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      industry: { findFirst: jest.fn().mockResolvedValue({ id: 'stone' }) },
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const policy = { qualityControl: { enabled: true, feeBps: 300 }, marketCoverageMode: 'NATIONWIDE' };
    const service = new RfqsService(prisma as never, {} as never, {} as never, { get: jest.fn().mockResolvedValue(policy) } as never);
    const internals = service as unknown as {
      findAuthorizedRfq: jest.Mock; validateItems: jest.Mock; resolveDeliveryLocation: jest.Mock;
    };
    internals.findAuthorizedRfq = jest.fn().mockResolvedValue(draft);
    internals.validateItems = jest.fn().mockResolvedValue(undefined);
    internals.resolveDeliveryLocation = jest.fn().mockResolvedValue({ provinceId: 'province-1', provinceCode: 'tehran', cityId: 'city-1', provinceName: 'تهران', cityName: 'تهران' });

    await expect(service.updateDraft(buyerUser as never, draft.id, input as never)).resolves.toEqual(updated);
    expect(tx.rfq.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: draft.id, updatedAt: originalUpdatedAt }),
    }));
    expect(tx.rfqItem.deleteMany).toHaveBeenCalledWith({ where: { rfqId: draft.id } });
    expect(tx.rfqItem.createMany).toHaveBeenCalledTimes(1);
    expect(tx.qualityControlRequest.upsert).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale browser copy before changing data', async () => {
    const service = new RfqsService({} as never, {} as never, {} as never, {} as never);
    (service as unknown as { findAuthorizedRfq: jest.Mock }).findAuthorizedRfq = jest.fn().mockResolvedValue(draft);

    await expect(service.updateDraft(buyerUser as never, draft.id, {
      ...input, expectedUpdatedAt: '2026-10-14T07:59:00.000Z',
    } as never)).rejects.toBeInstanceOf(ConflictException);
  });
});
