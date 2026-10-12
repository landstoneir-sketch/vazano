import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService dashboard summary', () => {
  it('scopes buyer and supplier counts to the current memberships', async () => {
    const rfqCount = jest.fn<Promise<number>, [unknown]>().mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const invitationCount = jest.fn<Promise<number>, [unknown]>().mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    const notificationCount = jest.fn<Promise<number>, [unknown]>().mockResolvedValue(5);
    const prisma = {
      rfq: { count: rfqCount },
      rfqInvitation: { count: invitationCount },
      notification: { count: notificationCount },
    } as unknown as PrismaService;
    const user: AuthenticatedUser = {
      id: 'user-1', mobile: '09120000000', status: 'ACTIVE', permissions: [], globalRoles: [],
      memberships: [
        { organizationId: 'buyer-1', role: 'BUYER_OWNER' },
        { organizationId: 'supplier-1', role: 'SUPPLIER_SALES' },
      ],
    };

    await expect(new UsersService(prisma).dashboardSummary(user)).resolves.toEqual({
      activeBuyerRfqs: 3,
      buyerRfqsWithQuotes: 2,
      supplierOpenInvitations: 4,
      supplierRespondedInvitations: 1,
      unreadNotifications: 5,
    });
    expect(rfqCount).toHaveBeenNthCalledWith(1, { where: {
      buyerOrganizationId: { in: ['buyer-1'] }, lifecycleState: { in: ['SUBMITTED', 'PUBLISHED'] },
    } });
    expect(invitationCount).toHaveBeenNthCalledWith(2, { where: {
      supplierOrganizationId: { in: ['supplier-1'] }, status: 'RESPONDED',
    } });
    expect(notificationCount).toHaveBeenCalledWith({ where: { recipientUserId: 'user-1', readAt: null, status: 'DELIVERED' } });
  });

  it('does not issue tenant queries when the user has no organization membership', async () => {
    const rfqCount = jest.fn();
    const invitationCount = jest.fn();
    const prisma = {
      rfq: { count: rfqCount },
      rfqInvitation: { count: invitationCount },
      notification: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const user: AuthenticatedUser = { id: 'user-1', mobile: '09120000000', status: 'ACTIVE', permissions: [], globalRoles: [], memberships: [] };

    await expect(new UsersService(prisma).dashboardSummary(user)).resolves.toEqual({
      activeBuyerRfqs: 0,
      buyerRfqsWithQuotes: 0,
      supplierOpenInvitations: 0,
      supplierRespondedInvitations: 0,
      unreadNotifications: 0,
    });
    expect(rfqCount).not.toHaveBeenCalled();
    expect(invitationCount).not.toHaveBeenCalled();
  });
});
