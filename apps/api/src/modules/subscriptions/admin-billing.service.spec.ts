import { ConflictException } from '@nestjs/common';
import { PaymentReconciliationResolution, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminBillingService } from './admin-billing.service';

const financeUser: AuthenticatedUser = {
  id: 'finance-1', mobile: '09120000000', status: 'ACTIVE', permissions: ['billing.manage'], globalRoles: ['FINANCE'], memberships: [],
};

describe('AdminBillingService payment reconciliation resolution', () => {
  it('records a finance decision without changing payment status', async () => {
    let updateInput: Prisma.PaymentIntentUpdateManyArgs | undefined;
    const payment = {
      id: 'payment-1', payerOrganizationId: 'organization-1', purpose: 'SUBSCRIPTION', status: 'FAILED',
      reconciliationStatus: 'ACTION_REQUIRED', reconciliationResolvedAt: null,
    };
    const tx = {
      paymentIntent: {
        updateMany: jest.fn((input: Prisma.PaymentIntentUpdateManyArgs) => { updateInput = input; return Promise.resolve({ count: 1 }); }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...payment, reconciliationResolvedAt: new Date() }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      paymentIntent: { findUnique: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminBillingService(prisma as never, {} as never);

    await service.resolvePaymentReconciliation(financeUser, payment.id, {
      resolution: PaymentReconciliationResolution.CUSTOMER_RETRY_REQUIRED, note: 'ارسال مسیر امن پرداخت مجدد به مشتری ثبت شد.',
    });

    expect(updateInput?.where).toEqual({ id: payment.id, reconciliationResolvedAt: null, reconciliationStatus: 'ACTION_REQUIRED' });
    expect(updateInput?.data).toMatchObject({
      reconciliationResolution: PaymentReconciliationResolution.CUSTOMER_RETRY_REQUIRED,
      reconciliationResolutionNote: 'ارسال مسیر امن پرداخت مجدد به مشتری ثبت شد.',
      reconciliationResolvedByUserId: financeUser.id,
    });
    expect(updateInput?.data).not.toHaveProperty('status');
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: {
      aggregateType: 'PaymentIntent', aggregateId: payment.id,
      eventType: 'ir.vazano.payment.retry_requested.v1',
      payload: { paymentId: payment.id, payerOrganizationId: payment.payerOrganizationId, purpose: payment.purpose },
    } });
  });

  it('rejects resolution for a reconciled payment', async () => {
    const prisma = {
      paymentIntent: { findUnique: jest.fn().mockResolvedValue({ id: 'payment-1', reconciliationStatus: 'MATCHED' }) },
    };
    const service = new AdminBillingService(prisma as never, {} as never);

    await expect(service.resolvePaymentReconciliation(financeUser, 'payment-1', {
      resolution: PaymentReconciliationResolution.NO_FINANCIAL_ACTION, note: 'تراکنش قبلاً به‌طور قطعی تطبیق شده است.',
    })).rejects.toBeInstanceOf(ConflictException);
  });
});
