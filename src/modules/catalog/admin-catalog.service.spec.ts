import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProductAttributeDataType } from '@prisma/client';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminCatalogService } from './admin-catalog.service';

const catalogManager: AuthenticatedUser = {
  id: 'catalog-manager',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: ['category.manage'],
  globalRoles: ['CONTENT_MANAGER'],
  memberships: [],
};

describe('AdminCatalogService', () => {
  it('blocks catalog access without the backend permission', () => {
    const findMany = jest.fn();
    const prisma = { category: { findMany } } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    expect(() => service.listCategories({ ...catalogManager, permissions: [] })).toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('requires options for selectable attributes', async () => {
    const transaction = jest.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.createAttribute(catalogManager, {
      code: 'stone_color',
      nameFa: 'رنگ سنگ',
      dataType: ProductAttributeDataType.SINGLE_SELECT,
      options: [],
      validation: {},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects options for non-selectable attributes', async () => {
    const transaction = jest.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.createAttribute(catalogManager, {
      code: 'thickness',
      nameFa: 'ضخامت',
      dataType: ProductAttributeDataType.NUMBER,
      options: ['۲ سانتی‌متر'],
      validation: {},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid numeric range before writing to the database', async () => {
    const transaction = jest.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.createAttribute(catalogManager, {
      code: 'thickness',
      nameFa: 'ضخامت',
      dataType: ProductAttributeDataType.NUMBER,
      options: [],
      validation: { min: 10, max: 2 },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('prevents a category from becoming its own parent', async () => {
    const updatedAt = new Date('2026-10-18T00:00:00.000Z');
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'category-1', industryId: 'industry-1', parentId: null, updatedAt }),
      },
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.updateCategory(catalogManager, 'category-1', {
      parentId: 'category-1',
      nameFa: 'تراورتن',
      sortOrder: 1,
      isActive: true,
      expectedUpdatedAt: updatedAt.toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents cross-industry parent assignments', async () => {
    const updatedAt = new Date('2026-10-18T00:00:00.000Z');
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ id: 'category-1', industryId: 'stone', parentId: null, updatedAt })
      .mockResolvedValueOnce({ id: 'category-2', industryId: 'steel', parentId: null });
    const prisma = { category: { findUnique } } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.updateCategory(catalogManager, 'category-1', {
      parentId: 'category-2',
      nameFa: 'تراورتن',
      sortOrder: 1,
      isActive: true,
      expectedUpdatedAt: updatedAt.toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
