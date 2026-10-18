import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SuppliersService } from './suppliers.service';
import { UpsertSupplierProfileDto } from './upsert-supplier-profile.dto';
import { PublicSupplierSearchDto } from './public-supplier-search.dto';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

describe('UpsertSupplierProfileDto', () => {
  it('rejects an overlong capacity description and non-boolean capability flag', async () => {
    const input = Object.assign(new UpsertSupplierProfileDto(), {
      productionCapacityDescription: 'الف'.repeat(1001),
      officialInvoiceAvailable: 'yes',
      nationwideCoverage: true,
      serviceProvinceIds: [],
      categories: [{ categoryId: 'category-1' }],
    });

    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['productionCapacityDescription', 'officialInvoiceAvailable']));
  });
});

describe('CreateSupplierProductDto', () => {
  it('rejects invalid product input before it reaches the service', async () => {
    const input = Object.assign(new CreateSupplierProductDto(), {
      categoryId: 'category-1', nameFa: 'ن', sku: '<script>', status: 'PUBLIC', specifications: [],
    });

    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['nameFa', 'sku', 'status', 'specifications']));
  });
});

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
      supplierProfile: { description: 'تولیدکننده سنگ ساختمانی', productionCapacityDescription: 'ظرفیت پروژه‌ای', minimumOrderDescription: null, leadTimeDescription: '۱۰ روز کاری', officialInvoiceAvailable: true, sampleAvailable: true, installationAvailable: false, nationwideCoverage: true, categories: [] },
    };
    const organizationFindMany = jest.fn<Promise<Array<typeof organization>>, [Prisma.OrganizationFindManyArgs]>().mockResolvedValue([organization]);
    const prisma = {
      organization: { findMany: organizationFindMany },
      supplierReview: { groupBy: jest.fn().mockResolvedValue([{ supplierOrganizationId: organization.id, _count: { _all: 2 }, _avg: { rating: 4.5 } }]) },
    } as unknown as PrismaService;
    const service = new SuppliersService(prisma);

    await expect(service.listPublicProfiles({ q: 'تراورتن', province: 'اصفهان', category: 'travertine' })).resolves.toEqual([{
      ...organization, reviewSummary: { count: 2, averageRating: 4.5 },
    }]);
    const searchWhere = organizationFindMany.mock.calls[0]?.[0]?.where;
    expect(searchWhere).toMatchObject({
      kind: 'SUPPLIER',
      status: 'ACTIVE',
      supplierProfile: { is: { verificationStatus: 'VERIFIED' } },
    });
    expect(Array.isArray(searchWhere?.AND)).toBe(true);
    expect(Array.isArray(searchWhere?.OR)).toBe(true);
  });

  it('validates public search input before it reaches the database', async () => {
    const input = Object.assign(new PublicSupplierSearchDto(), { q: 'ت', category: '../all', province: 'الف'.repeat(81) });

    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['q', 'category', 'province']));
  });
});

describe('SuppliersService product tenant isolation', () => {
  it('does not expose a supplier product list to another organization', async () => {
    const service = new SuppliersService({} as PrismaService);
    const outsider: AuthenticatedUser = {
      id: 'user-2', mobile: '09120000002', status: 'ACTIVE', permissions: [], globalRoles: [],
      memberships: [{ organizationId: 'supplier-2', role: 'SUPPLIER_OWNER' }],
    };

    await expect(service.listProducts(outsider, 'supplier-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns an empty product list while the supplier profile is not created yet', async () => {
    const prisma = { supplierProfile: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const service = new SuppliersService(prisma);
    const owner: AuthenticatedUser = {
      id: 'user-1', mobile: '09120000001', status: 'ACTIVE', permissions: [], globalRoles: [],
      memberships: [{ organizationId: 'supplier-1', role: 'SUPPLIER_OWNER' }],
    };

    await expect(service.listProducts(owner, 'supplier-1')).resolves.toEqual([]);
  });
});
