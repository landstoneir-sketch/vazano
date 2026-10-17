import { NotificationsService } from './notifications.service';

describe('NotificationsService support routing', () => {
  it('routes billing tickets to finance while keeping support staff in the support queue', async () => {
    const event = {
      id: 'event-1', eventType: 'ir.vazano.support.ticket.created.v1',
      aggregateType: 'SupportTicket', aggregateId: 'ticket-1', payload: {},
    };
    let notificationsInput: { data: Array<{ recipientUserId: string; actionPath?: string }> } | undefined;
    const tx = {
      notificationDispatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      notificationTemplate: { findUnique: jest.fn().mockResolvedValue({
        id: 'template-1', code: 'SUPPORT_CREATED', version: 1, isActive: true,
        titleTemplate: 'درخواست جدید', bodyTemplate: 'درخواست مالی جدید', actionPathTemplate: null,
      }) },
      supportTicket: { findUnique: jest.fn().mockResolvedValue({
        id: 'ticket-1', code: 'VZT-1', type: 'SERVICE_REQUEST', category: 'BILLING',
        priority: 'P3', subject: 'تمدید دستی',
      }) },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: 'finance-user', userRoles: [{ role: { key: 'FINANCE' } }] },
        { id: 'support-user', userRoles: [{ role: { key: 'SUPPORT' } }] },
      ]) },
      notification: { createMany: jest.fn((input: { data: Array<{ recipientUserId: string; actionPath?: string }> }) => {
        notificationsInput = input;
        return Promise.resolve({ count: input.data.length });
      }) },
    };
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never);

    await expect(service.processPendingEvents()).resolves.toEqual({ events: 1, notifications: 2 });
    expect(notificationsInput?.data.find((item) => item.recipientUserId === 'finance-user')?.actionPath).toBe('/admin/billing');
    expect(notificationsInput?.data.find((item) => item.recipientUserId === 'support-user')?.actionPath).toBe('/admin/support');
  });
});

describe('NotificationsService supplier verification routing', () => {
  it('notifies active supplier members when the verification decision changes', async () => {
    const event = {
      id: 'event-supplier-verification', eventType: 'ir.vazano.supplier.verification.changed.v1',
      aggregateType: 'SupplierProfile', aggregateId: 'profile-1', payload: {},
    };
    let notificationsInput: { data: Array<{ recipientUserId: string; actionPath?: string; body: string }> } | undefined;
    const tx = {
      notificationDispatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      notificationTemplate: { findUnique: jest.fn().mockResolvedValue({
        id: 'template-verification', code: 'SUPPLIER_VERIFICATION_CHANGED', version: 1, isActive: true,
        titleTemplate: 'نتیجه بررسی', bodyTemplate: '{{supplierName}} {{verificationStatus}}: {{verificationReason}}', actionPathTemplate: null,
      }) },
      supplierProfile: { findUnique: jest.fn().mockResolvedValue({
        organizationId: 'supplier-org-1', verificationStatus: 'NEEDS_CORRECTION', verificationReason: 'تصویر مجوز خوانا نیست',
        organization: { displayName: 'سنگ نمونه', members: [{ userId: 'supplier-owner' }, { userId: 'supplier-sales' }] },
      }) },
      notification: { createMany: jest.fn((input: { data: Array<{ recipientUserId: string; actionPath?: string; body: string }> }) => {
        notificationsInput = input;
        return Promise.resolve({ count: input.data.length });
      }) },
    };
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never);

    await expect(service.processPendingEvents()).resolves.toEqual({ events: 1, notifications: 2 });
    expect(notificationsInput?.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientUserId: 'supplier-owner', actionPath: '/supplier/profile/supplier-org-1' }),
      expect.objectContaining({ recipientUserId: 'supplier-sales', actionPath: '/supplier/profile/supplier-org-1' }),
    ]));
    expect(notificationsInput?.data[0]?.body).toContain('نیازمند اصلاح است');
  });
});
