import { resolveMarketplaceNotificationTargets } from './marketplace-notification-targets';

describe('marketplace notification targets', () => {
  it('deduplicates supplier members when an RFQ is distributed', async () => {
    const tx = {
      rfq: { findUnique: jest.fn().mockResolvedValue({
        code: 'VZR-1', title: 'سنگ نما',
        invitations: [
          { supplierOrganizationId: 'supplier-1', supplierOrganization: { members: [{ userId: 'user-1' }] } },
          { supplierOrganizationId: 'supplier-2', supplierOrganization: { members: [{ userId: 'user-1' }, { userId: 'user-2' }] } },
        ],
      }) },
    };

    const targets = await resolveMarketplaceNotificationTargets(tx as never, {
      id: 'event-1', eventType: 'ir.vazano.rfq.distributed.v1', aggregateType: 'Rfq', aggregateId: 'rfq-1', payload: {},
    });

    expect(targets).toHaveLength(2);
    expect(targets?.map((target) => target.userId).sort()).toEqual(['user-1', 'user-2']);
  });

  it('notifies both buyer and selected supplier when a quotation is accepted', async () => {
    const tx = {
      quotation: { findUnique: jest.fn().mockResolvedValue({
        code: 'VZQ-1', supplierOrganizationId: 'supplier-1',
        supplierOrganization: { displayName: 'سنگ نمونه', members: [{ userId: 'supplier-owner' }] },
        rfq: { id: 'rfq-1', code: 'VZR-1', buyerContactUserId: 'buyer-owner', buyerOrganizationId: 'buyer-1' },
      }) },
    };

    const targets = await resolveMarketplaceNotificationTargets(tx as never, {
      id: 'event-2', eventType: 'ir.vazano.quotation.accepted.v1', aggregateType: 'Quotation', aggregateId: 'quotation-1', payload: {},
    });

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 'buyer-owner', actionPath: '/dashboard/rfqs/rfq-1' }),
      expect.objectContaining({ userId: 'supplier-owner', actionPath: '/supplier' }),
    ]));
  });

  it('notifies the buyer contact when a supplier declines an RFQ invitation', async () => {
    const tx = {
      rfqInvitation: { findUnique: jest.fn().mockResolvedValue({
        supplierOrganization: { displayName: 'سنگ نمونه' },
        rfq: { id: 'rfq-1', code: 'VZR-1', buyerContactUserId: 'buyer-owner', buyerOrganizationId: 'buyer-1' },
      }) },
    };

    const targets = await resolveMarketplaceNotificationTargets(tx as never, {
      id: 'event-3', eventType: 'ir.vazano.rfq.invitation.declined.v1', aggregateType: 'RfqInvitation', aggregateId: 'invitation-1', payload: {},
    });

    expect(targets).toEqual([{
      userId: 'buyer-owner',
      organizationId: 'buyer-1',
      actionPath: '/dashboard/rfqs/rfq-1',
      variables: { rfqCode: 'VZR-1', supplierName: 'سنگ نمونه' },
    }]);
  });
});
