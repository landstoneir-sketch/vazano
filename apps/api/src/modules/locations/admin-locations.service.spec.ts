import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminLocationsService } from './admin-locations.service';

const locationManager: AuthenticatedUser = {
  id: 'location-manager',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: ['location.manage'],
  globalRoles: ['ADMIN'],
  memberships: [],
};

describe('AdminLocationsService', () => {
  it('blocks location management without the backend permission', () => {
    const findMany = jest.fn();
    const prisma = { province: { findMany } } as unknown as PrismaService;
    const service = new AdminLocationsService(prisma);

    expect(() => service.listProvinces({ ...locationManager, permissions: [] })).toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('prevents deactivating a province that still has active cities', async () => {
    const updatedAt = new Date('2026-10-18T00:00:00.000Z');
    const transaction = jest.fn();
    const prisma = {
      province: { findUnique: jest.fn().mockResolvedValue({ id: 'province-1', code: 'tehran', updatedAt }) },
      city: { count: jest.fn().mockResolvedValue(1) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new AdminLocationsService(prisma);

    await expect(service.updateProvince(locationManager, 'province-1', {
      nameFa: 'تهران', sortOrder: 1, isActive: false, expectedUpdatedAt: updatedAt.toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects creating an active city under an inactive province', async () => {
    const transaction = jest.fn();
    const prisma = {
      province: { findUnique: jest.fn().mockResolvedValue({ isActive: false }) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new AdminLocationsService(prisma);

    await expect(service.createCity(locationManager, {
      provinceId: 'inactive-province', code: 'sample-city', nameFa: 'شهر نمونه', sortOrder: 10,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows staging an inactive city under an inactive province', async () => {
    const createdCity = { id: 'city-1', provinceId: 'inactive-province', code: 'sample-city', nameFa: 'شهر نمونه', isActive: false };
    const tx = {
      city: { create: jest.fn().mockResolvedValue(createdCity) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      province: { findUnique: jest.fn().mockResolvedValue({ isActive: false }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new AdminLocationsService(prisma);

    await expect(service.createCity(locationManager, {
      provinceId: 'inactive-province', code: 'sample-city', nameFa: 'شهر نمونه', sortOrder: 10, isActive: false,
    })).resolves.toEqual(createdCity);
    expect(tx.city.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
