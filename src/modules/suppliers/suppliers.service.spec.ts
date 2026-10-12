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

describe('SuppliersService public directory', () => {
  it('returns only the explicitly selected public profile fields with published rating summary', async () => {
    const organization = {
      id: 'supplier-organization-1', displayName: 'سنگ نمونه', province: 'اصفهان', city: 'اصفهان',
      supplierProfile: { description: 'تولیدکننده سنگ ساختمانی', nationwideCoverage: true, categories: [] },
    };
    const organizationFindMany = jest.fn().mockResolvedValue([organization]);
    const prisma = {
      organization: { findMany: organizationFindMany },
      supplierReview: { groupBy: jest.fn().mockResolvedValue([{ supplierOrganizationId: organization.id, _count: { _all: 2 }, _avg: { rating: 4.5 } }]) },
    } as unknown as PrismaService;
    const service = new SuppliersService(prisma);

    await expect(service.listPublicProfiles()).resolves.toEqual([{
      ...organization, reviewSummary: { count: 2, averageRating: 4.5 },
    }]);
    expect(organizationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'SUPPLIER', status: 'ACTIVE', supplierProfile: { verificationStatus: 'VERIFIED' } },
    }));
  });
});
