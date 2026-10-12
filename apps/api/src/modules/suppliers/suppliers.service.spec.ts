import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService verification', () => {
  it('rejects approval when no clean verification document exists', async () => {
    const prisma = {
      supplierProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'supplier-profile-1' }) },
      attachment: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new SuppliersService(prisma);
    const verifier: AuthenticatedUser = {
      id: 'admin-1',
      mobile: '09120000000',
      status: 'ACTIVE',
      permissions: ['supplier.verify'],
      globalRoles: ['ADMIN'],
      memberships: [],
    };

    await expect(service.verify(verifier, 'supplier-organization-1', { status: 'VERIFIED' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
