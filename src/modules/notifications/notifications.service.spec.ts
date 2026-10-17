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

describe('NotificationsService quality control routing', () => {
  it('notifies both the buyer and operations when payment activates the service', async () => {
    const event = {
      id: 'event-quality-control', eventType: 'ir.vazano.quality_control.accepted.v1',
      aggregateType: 'QualityControlRequest', aggregateId: 'quality-1', payload: {},
    };
    let notificationsInput: { data: Array<{ recipientUserId: string; actionPath?: string }> } | undefined;
    const tx = {
      notificationDispatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      notificationTemplate: { findUnique: jest.fn().mockResolvedValue({
        id: 'template-quality', code: 'QUALITY_ACCEPTED', version: 1, isActive: true,
        titleTemplate: 'درخواست فعال شد', bodyTemplate: 'استعلام {{rfqCode}}', actionPathTemplate: null,
      }) },
      qualityControlRequest: { findUnique: jest.fn().mockResolvedValue({
        status: 'ACCEPTED', feeAmountRial: 3_000_000n,
        rfq: {
          id: 'rfq-1', code: 'VZR-1', title: 'سنگ نمای پروژه', buyerOrganizationId: 'buyer-org-1',
          buyerOrganization: { members: [{ userId: 'buyer-owner' }] },
        },
      }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'operations-user' }]) },
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
    expect(notificationsInput?.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientUserId: 'buyer-owner', actionPath: '/dashboard/rfqs/rfq-1' }),
      expect.objectContaining({ recipientUserId: 'operations-user', actionPath: '/admin/quality-control' }),
    ]));
  });
});

describe('NotificationsService supplier review routing', () => {
  it('notifies active members of the reviewed supplier organization', async () => {
    const event = {
      id: 'event-review', eventType: 'ir.vazano.supplier.review_published.v1',
      aggregateType: 'SupplierReview', aggregateId: 'review-1', payload: {},
    };
    let notificationsInput: { data: Array<{ recipientUserId: string; body: string }> } | undefined;
    const tx = {
      notificationDispatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      notificationTemplate: { findUnique: jest.fn().mockResolvedValue({
        id: 'template-review', code: 'SUPPLIER_REVIEW', version: 1, isActive: true,
        titleTemplate: 'امتیاز جدید', bodyTemplate: '{{rfqCode}}: {{rating}} از ۵', actionPathTemplate: null,
      }) },
      supplierReview: { findUnique: jest.fn().mockResolvedValue({
        rating: 5, supplierOrganizationId: 'supplier-org-1',
        supplierOrganization: { members: [{ userId: 'supplier-owner' }] },
        rfq: { code: 'VZR-20' },
      }) },
      notification: { createMany: jest.fn((input: { data: Array<{ recipientUserId: string; body: string }> }) => {
        notificationsInput = input;
        return Promise.resolve({ count: input.data.length });
      }) },
    };
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never);

    await expect(service.processPendingEvents()).resolves.toEqual({ events: 1, notifications: 1 });
    expect(notificationsInput?.data[0]).toEqual(expect.objectContaining({ recipientUserId: 'supplier-owner' }));
    expect(notificationsInput?.data[0]?.body).toContain('۵ از ۵');
  });
});

describe('NotificationsService buyer commitment routing', () => {
  it('notifies the buyer organization after the commitment payment is held', async () => {
    const event = {
      id: 'event-commitment', eventType: 'ir.vazano.buyer.commitment.held.v1',
      aggregateType: 'Rfq', aggregateId: 'rfq-1', payload: { receiptNumber: 'VZR-1001' },
    };
    let notificationsInput: { data: Array<{ recipientUserId: string; body: string }> } | undefined;
    const tx = {
      notificationDispatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      notificationTemplate: { findUnique: jest.fn().mockResolvedValue({
        id: 'template-commitment', code: 'BUYER_COMMITMENT', version: 1, isActive: true,
        titleTemplate: 'سپرده ثبت شد', bodyTemplate: '{{rfqCode}}: {{receiptNumber}}', actionPathTemplate: null,
      }) },
      rfq: { findUnique: jest.fn().mockResolvedValue({
        id: 'rfq-1', code: 'VZR-22', buyerOrganizationId: 'buyer-org-1',
        buyerOrganization: { members: [{ userId: 'buyer-owner' }] },
      }) },
      notification: { createMany: jest.fn((input: { data: Array<{ recipientUserId: string; body: string }> }) => {
        notificationsInput = input;
        return Promise.resolve({ count: input.data.length });
      }) },
    };
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never);

    await expect(service.processPendingEvents()).resolves.toEqual({ events: 1, notifications: 1 });
    expect(notificationsInput?.data[0]).toEqual(expect.objectContaining({ recipientUserId: 'buyer-owner' }));
    expect(notificationsInput?.data[0]?.body).toContain('VZR-1001');
  });
});
