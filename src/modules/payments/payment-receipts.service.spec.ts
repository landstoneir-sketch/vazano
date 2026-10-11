import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentReceiptsService } from './payment-receipts.service';

const user: AuthenticatedUser = {
  id: 'user-1', mobile: '09120000000', status: 'ACTIVE', permissions: [], globalRoles: [], memberships: [],
};

describe('PaymentReceiptsService', () => {
  it('rejects cross-organization receipt access', async () => {
    const prisma = { paymentReceipt: { findUnique: jest.fn().mockResolvedValue({ id: 'receipt-1', organizationId: 'organization-b' }) } } as unknown as PrismaService;
    const service = new PaymentReceiptsService(prisma);

    await expect(service.getById(user, 'receipt-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a member of the owning organization to read the receipt', async () => {
    const receipt = { id: 'receipt-1', organizationId: 'organization-a' };
    const prisma = { paymentReceipt: { findUnique: jest.fn().mockResolvedValue(receipt) } } as unknown as PrismaService;
    const service = new PaymentReceiptsService(prisma);
    const member = { ...user, memberships: [{ organizationId: 'organization-a', role: 'BUYER_OWNER' as const }] };

    await expect(service.getById(member, 'receipt-1')).resolves.toBe(receipt);
  });
});
