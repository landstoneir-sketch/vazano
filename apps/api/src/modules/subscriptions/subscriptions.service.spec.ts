import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

const baseUser: AuthenticatedUser = {
  id: 'user-1',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [],
};

describe('SubscriptionsService receipt access', () => {
  it('rejects cross-organization receipt access', () => {
    const findMany = jest.fn();
    const prisma = { paymentReceipt: { findMany } } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma);

    expect(() => service.listReceiptsForOrganization(baseUser, 'organization-b')).toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('allows a member to list only receipts of their organization', () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { paymentReceipt: { findMany } } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma);
    const member: AuthenticatedUser = {
      ...baseUser,
      memberships: [{ organizationId: 'organization-a', role: 'SUPPLIER_OWNER' }],
    };

    void service.listReceiptsForOrganization(member, 'organization-a');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'organization-a' } }));
  });
});
